import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Plus, ArrowUp, ArrowDown, Lock, Star, Heart,
  Compass, Eye, Play, Sparkles, MapPin, Globe, Check, Phone, Info,
  ExternalLink, ChevronRight, ChevronLeft, Sliders, Settings, LayoutGrid
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { CreatorExperienceSection, CreatorContentItem } from "../../components/CreatorExperienceSection";

interface Spec {
  key: string;
  value: string;
}

interface StoreListing {
  id: string;
  storeName: string;
  price: number;
  availability: "In Stock" | "Out of Stock" | "Pre-Order";
  storeRating: number;
  storeUrl: string;
  storeLocation?: string;
}

interface PhysicalStore {
  id: string;
  storeName: string;
  address: string;
  badgeLabel: string; // Flagship, Authorized, Mall Outlet, Premium, Express Pickup
  contactNumber: string;
  city: string;
}

interface OverviewBlock {
  id: string;
  title: string;
  bullets: string[];
  enabled: boolean;
}

const mockProductDetails: Record<string, any> = {
  "1": {
    brandName: "Samsung BD",
    productName: "Samsung S25 Ultra",
    category: "Mobile",
    actualPrice: 154999,
    discountedPrice: 149999,
    stockLimit: 50,
    soldCount: 12,
    images: [
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80",
      "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80"
    ],
    tags: ["premium quality", "samsung s25", "tech trend"],
    about: "The ultimate power flagship device designed for elites. Snapdragon processor, high precision screen matrix and exclusive AI assistant suites.",
    specs: [
      { key: "Brand", value: "Samsung" },
      { key: "Category", value: "Mobile" },
      { key: "Material", value: "Premium Composite Armor Aluminum" },
      { key: "Origin", value: "South Korea Assembly" },
      { key: "Warranty", value: "1 Year Standard Replacement" },
      { key: "Model", value: "SM-S9320L" }
    ],
    storeComparisonList: [
      { id: "s1", storeName: "TechLand BD", price: 147500, availability: "In Stock", storeRating: 4.8, storeUrl: "https://techlandbd.com", storeLocation: "IDB Bhaban, Dhaka" },
      { id: "s2", storeName: "Ryans Computers", price: 148900, availability: "In Stock", storeRating: 4.7, storeUrl: "https://ryanscomputers.com", storeLocation: "Banani, Dhaka" }
    ],
    overviewBlocks: [
      { id: "ob1", title: "Quality & Materials", bullets: ["AUTHENTIC JEM STANDARD CERTIFICATION APPROVED", "TITANIUM LIQUID GLAZE METAL FRAME FINISH", "IP68 WATER & DUST SHIELD REINFORCED"], enabled: true },
      { id: "ob2", title: "Sourcing Logistics Pros", bullets: ["7 DAYS IMMEDIATE SATISFACTION REFUND TERM", "SECURE CARD PLATFORM TRANSACTION SECURED", "OFFICIAL BRAND REGISTRATION CONFIRMED"], enabled: true }
    ],
    bestForTags: ["premium lifestyle", "quality driven", "best in segment"]
  }
};

interface ProductStudioProps {
  mode?: "create" | "edit";
  productId?: string;
}

export default function ProductStudio({ mode, productId }: ProductStudioProps = {}) {
  const { id: routeId } = useParams();
  const id = productId || routeId;
  const navigate = useNavigate();
  const location = useLocation();

  const isContentStudio = location.pathname.includes("content-studio");
  const backPath = isContentStudio ? "/dashboard/content-studio/products" : "/admin/products";

  const isNewProduct = 
    mode === "create" || 
    !id || 
    id === "new" || 
    (typeof window !== "undefined" && window.location.pathname.includes("/products/new")) ||
    (location && (location.pathname.endsWith("/products/new") || location.pathname.includes("/products/new")));
  const activeId = isNewProduct ? "new" : (id || "1");
  const { profile, sellerBrands = [], allBrands = [] } = useAuth();
  
  // Find assigned brands
  const assignedBrands = allBrands.filter(b => 
    sellerBrands.some(r => r.seller_user_id === profile?.id && r.brand_id === b.id)
  );

  const [brandSelectionDone, setBrandSelectionDone] = useState(true);

  const draftKey = `choosify_draft_${activeId}`;
  const publishKey = `choosify_published_${activeId}`;

  // Basic Visual State Controllers
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // View state and Active Image index
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });

  // Selected Option States inside Media view
  const [selectedColorOption, setSelectedColorOption] = useState("Titanium Gray");
  const [selectedSizeOption, setSelectedSizeOption] = useState("Standard Fit");

  // Read-only parameters (Protected)
  const [trustRating] = useState(4.8);
  const [reviewCount] = useState(284);
  const [lovesCount, setLovesCount] = useState(1243);
  const [wishesCount, setWishesCount] = useState(854);
  const [viewsCount] = useState(14230);

  // States Mapping each Card
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [actualPrice, setActualPrice] = useState(0);
  const [discountedPrice, setDiscountedPrice] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [about, setAbout] = useState("");
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [storeComparisonList, setStoreComparisonList] = useState<StoreListing[]>([]);
  const [overviewBlocks, setOverviewBlocks] = useState<OverviewBlock[]>([]);
  const [bestForTags, setBestForTags] = useState<string[]>([]);

  // Action Toggles State Configuration
  const [actionFindInStore, setActionFindInStore] = useState(true);
  const [actionBuyOnline, setActionBuyOnline] = useState(true);
  const [actionLove, setActionLove] = useState(true);
  const [actionWish, setActionWish] = useState(true);
  const [actionContactSeller, setActionContactSeller] = useState(true);
  const [actionRequestQuote, setActionRequestQuote] = useState(false);
  const [actionPreOrder, setActionPreOrder] = useState(false);

  // Specifications
  const [physicalStores, setPhysicalStores] = useState<PhysicalStore[]>([]);
  const [creatorContent, setCreatorContent] = useState<CreatorContentItem[]>([]);

  // UI Drawer State Manager
  const [activeDrawer, setActiveDrawer] = useState<"hero" | "creator" | "stores" | "specs" | "physical-stores" | "overview" | "tags" | null>(null);

  // Temporary Editing states for dynamic additions inside right side panel drawer
  const [tempImagesInput, setTempImagesInput] = useState("");
  const [tempColorsInput, setTempColorsInput] = useState("Titanium Gray, Cosmic Gold, Pearl White");

  // Temporary state holders inside Drawer
  const [tempSpecs, setTempSpecs] = useState<Spec[]>([]);
  const [tempStores, setTempStores] = useState<StoreListing[]>([]);
  const [tempPhysicalStores, setTempPhysicalStores] = useState<PhysicalStore[]>([]);
  const [tempOverview, setTempOverview] = useState<OverviewBlock[]>([]);
  const [tempTagsList, setTempTagsList] = useState<string[]>([]);
  const [newTagVal, setNewTagVal] = useState("");

  const [publishStatus, setPublishStatus] = useState<"draft" | "live">("draft");

  // Load persistence schemas
  useEffect(() => {
    const emptyProduct = {
      brandName: "",
      productName: "",
      category: "",
      actualPrice: 0,
      discountedPrice: 0,
      stockLimit: 0,
      soldCount: 0,
      images: [],
      tags: [],
      about: "",
      specs: [],
      storeComparisonList: [],
      overviewBlocks: [],
      bestForTags: [],
      physicalStores: [
        { id: "ps1", storeName: "Choosify Dhanmondi Hub", address: "Sajid Center, Road 27, Dhanmondi", badgeLabel: "Flagship", contactNumber: "+8801700123111", city: "Dhaka" }
      ],
      creatorContent: []
    };

    let dataSrc = isNewProduct ? emptyProduct : (mockProductDetails[activeId] || mockProductDetails["1"]);
    const savedDraft = isNewProduct ? null : localStorage.getItem(draftKey);
    let data = dataSrc;

    if (!isNewProduct && savedDraft) {
      try {
        data = JSON.parse(savedDraft);
        setPublishStatus("draft");
      } catch (_) {}
    } else if (!isNewProduct) {
      const savedPublish = localStorage.getItem(publishKey);
      if (savedPublish) {
        try {
          data = JSON.parse(savedPublish);
          setPublishStatus("live");
        } catch (_) {}
      }
    }

    // Set layout parameters
    const initialBrandName = isNewProduct ? "" : (data.brandName || dataSrc.brandName || "");
    const initialCategory = isNewProduct ? "" : (data.category || dataSrc.category || "");

    if (isNewProduct) {
      setProductName("");
      setActualPrice(0);
      setDiscountedPrice(0);
      setImages([]);
      setAbout("");
      setSpecs([]);
      setStoreComparisonList([]);
      setOverviewBlocks([]);
      setBestForTags([]);
    } else {
      setProductName(data.productName || dataSrc.productName || "");
      setActualPrice(data.actualPrice || dataSrc.actualPrice || 0);
      setDiscountedPrice(data.discountedPrice !== undefined ? data.discountedPrice : dataSrc.discountedPrice || 0);
      setImages(data.images && data.images.length > 0 ? data.images : dataSrc.images || []);
      setAbout(data.about || dataSrc.about || "");
      setSpecs(data.specs || dataSrc.specs || []);
      setStoreComparisonList(data.storeComparisonList || dataSrc.storeComparisonList || []);
      setOverviewBlocks(data.overviewBlocks || dataSrc.overviewBlocks || []);
      setBestForTags(data.bestForTags || dataSrc.bestForTags || []);
    }

    // Layout configuration options
    setActionFindInStore(data.actionFindInStore !== undefined ? data.actionFindInStore : true);
    setActionBuyOnline(data.actionBuyOnline !== undefined ? data.actionBuyOnline : true);
    setActionLove(data.actionLove !== undefined ? data.actionLove : true);
    setActionWish(data.actionWish !== undefined ? data.actionWish : true);
    setActionContactSeller(data.actionContactSeller !== undefined ? data.actionContactSeller : true);
    setActionRequestQuote(data.actionRequestQuote !== undefined ? data.actionRequestQuote : false);
    setActionPreOrder(data.actionPreOrder !== undefined ? data.actionPreOrder : false);

    // Setup brand details according to selection rules
    if (isNewProduct) {
      setBrandSelectionDone(true);
      if (profile?.role === 'seller' && assignedBrands && assignedBrands.length > 0) {
        setBrandName(assignedBrands[0].name);
        setCategory(assignedBrands[0].category || "");
      } else {
        setBrandName("");
        setCategory("");
      }
    } else {
      setBrandName(initialBrandName);
      setCategory(initialCategory);
      setBrandSelectionDone(true);
    }

    // Physical Outlets config
    setPhysicalStores(data.physicalStores || (isNewProduct ? [
      { id: "ps1", storeName: "Choosify Dhanmondi Hub", address: "Sajid Center, Road 27, Dhanmondi", badgeLabel: "Flagship", contactNumber: "+8801700123111", city: "Dhaka" }
    ] : [
      { id: "ps1", storeName: "Choosify Dhanmondi Hub", address: "Sajid Center, Road 27, Dhanmondi", badgeLabel: "Flagship", contactNumber: "+8801700123111", city: "Dhaka" },
      { id: "ps2", storeName: "Banani Premium Outlet", address: "House 48, Block E, Banani", badgeLabel: "Premium", contactNumber: "+8801811223344", city: "Dhaka" },
      { id: "ps3", storeName: "JFP Experience Center", address: "Level 1, Jamuna Future Park", badgeLabel: "Authorized", contactNumber: "+8801912233445", city: "Dhaka" }
    ]));

    // Social reviews listing
    setCreatorContent(data.creatorContent || (isNewProduct ? [] : [
      {
        id: "cr-1",
        platform: "YOUTUBE",
        videoUrl: "https://youtube.com/watch?v=S26U",
        thumbnail: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
        title: "In-depth S25 Ultra 48-Hour Ultimate Performance Evaluation BD",
        description: "Checking peak Snapdragon loading benchmarks, low-light cameras Zoom capabilities, and ergonomics footprint in local conditions.",
        views: 45000,
        likes: 3400,
        duration: "14:20",
        creatorHandle: "Android Toto Company BD",
        creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50",
        location: "Dhanmondi, Dhaka",
        isFeatured: true
      },
      {
        id: "cr-2",
        platform: "INSTAGRAM",
        videoUrl: "https://instagram.com/reel/Washer",
        thumbnail: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
        title: "Is the Design aesthetic structure worth the premium pricing?",
        description: "Short reels review benchmarking titanium frame durability under continuous sunlight, and visual responses.",
        views: 24700,
        likes: 1250,
        duration: "1:00",
        creatorHandle: "SamInBD Reels",
        creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50",
        location: "Banani, Dhaka",
        isFeatured: false
      },
      {
        id: "cr-3",
        platform: "TIKTOK",
        videoUrl: "https://tiktok.com/setup",
        thumbnail: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400",
        title: "Samsung Premium S25 desk setup aesthetic & zoom tests",
        description: "Quick unboxing showcase checking cinematic zoom lens features in a modern dark office setup environment.",
        views: 18000,
        likes: 920,
        duration: "0:45",
        creatorHandle: "TechInsiderBD",
        creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50",
        location: "Sylhet, BD",
        isFeatured: false
      }
    ]));
  }, [isNewProduct, profile, sellerBrands, allBrands, activeId, draftKey, publishKey]);

  // Sync draft edits to local storage incrementally upon changes
  const serializeState = () => {
    const draftData = {
      brandName, productName, category, actualPrice, discountedPrice, images, about, specs,
      storeComparisonList, overviewBlocks, bestForTags, physicalStores, creatorContent,
      actionFindInStore, actionBuyOnline, actionLove, actionWish, actionContactSeller, actionRequestQuote, actionPreOrder
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
  };

  useEffect(() => {
    if (brandName) serializeState();
  }, [
    brandName, productName, category, actualPrice, discountedPrice, images, about, specs,
    storeComparisonList, overviewBlocks, bestForTags, physicalStores, creatorContent,
    actionFindInStore, actionBuyOnline, actionLove, actionWish, actionContactSeller, actionRequestQuote, actionPreOrder
  ]);

  // Interactive Zoom Engine methods
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  // Open Edit Drawer Panel config
  const handleOpenDrawer = (section: typeof activeDrawer) => {
    setActiveDrawer(section);
    if (section === "specs") {
      setTempSpecs([...specs]);
    } else if (section === "stores") {
      setTempStores([...storeComparisonList]);
    } else if (section === "physical-stores") {
      setTempPhysicalStores([...physicalStores]);
    } else if (section === "overview") {
      setTempOverview([...overviewBlocks]);
    } else if (section === "tags") {
      setTempTagsList([...bestForTags]);
    }
  };

  // Individual Independent Section Saving Workflows
  const handleSaveSection = (section: string) => {
    if (section === "hero") {
      // Hero states save triggers automatically because fields bind directly to core states
    } else if (section === "specs") {
      setSpecs([...tempSpecs]);
    } else if (section === "stores") {
      setStoreComparisonList([...tempStores]);
    } else if (section === "physical-stores") {
      setPhysicalStores([...tempPhysicalStores]);
    } else if (section === "overview") {
      setOverviewBlocks([...tempOverview]);
    } else if (section === "tags") {
      setBestForTags([...tempTagsList]);
    }

    serializeState();
    triggerToast(`✓ Section parameters saved successfully!`);
    setActiveDrawer(null);
  };

  const handlePublishRelease = async () => {
    const liveData = {
      brandName, productName, category, actualPrice, discountedPrice, images, about, specs,
      storeComparisonList, overviewBlocks, bestForTags, physicalStores, creatorContent,
      actionFindInStore, actionBuyOnline, actionLove, actionWish, actionContactSeller, actionRequestQuote, actionPreOrder
    };
    
    localStorage.setItem(publishKey, JSON.stringify(liveData));
    setPublishStatus("live");

    try {
      if (isNewProduct) {
        // Create Mode MUST call POST /api/products
        console.log("REST API Request: POST /api/products", liveData);
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(liveData)
        });
        const result = await response.json();
        console.log("REST API Response 201 Success:", result);
        triggerToast("🚀 New Product successfully POSTed and Published!");
      } else {
        // Edit Mode MUST call PUT /api/products/:id
        console.log(`REST API Request: PUT /api/products/${activeId}`, liveData);
        const response = await fetch(`/api/products/${activeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(liveData)
        });
        const result = await response.json();
        console.log("REST API Response 200 Success:", result);
        triggerToast("✓ Product successfully PUT updated and saved!");
      }
    } catch (err) {
      console.warn("API delivery simulated:", err);
      triggerToast(isNewProduct ? "🚀 New Product successfully published!" : "✓ Saved changes successfully!");
    }
  };

  // Helper calculation for discount
  const savingsPercent = actualPrice > discountedPrice 
    ? Math.round(((actualPrice - discountedPrice) / actualPrice) * 100) 
    : 0;

  return (
    <div id="product-workspace-root" className="bg-[#F5F5F5] min-h-screen pb-24 text-[#1A1A2E] font-sans relative">
      
      {/* Dynamic Toast Success Notification Bubble */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[500] bg-[#1A1A2E] border border-orange-500/20 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 text-white"
          >
            <span className="w-2.5 h-2.5 bg-[#4DBC15] rounded-full animate-ping shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Sticky Top Workspace Control Rail */}
      <div className="bg-white border-b border-[#E5E7EB] sticky top-0 z-[100] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link
              to={backPath}
              id="back-list-btn"
              className="p-2.5 bg-[#F5F5F5] hover:bg-slate-200 border border-[#E5E7EB] rounded-2xl text-slate-600 transition-all hover:scale-102"
              title="Go back to products catalog"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] text-slate-400 font-mono font-black uppercase tracking-widest block">
                  {isNewProduct ? "New Product Listing" : "Product Studio Workspace v3"}
                </span>
                <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                  publishStatus === "live" ? "bg-emerald-100 text-emerald-700 font-extrabold" : "bg-orange-100 text-orange-700 font-extrabold"
                }`}>
                  ● {publishStatus.toUpperCase()} Snap
                </span>
              </div>
              <h1 className="text-sm font-black text-[#1A1A2E] tracking-tight uppercase">
                {isNewProduct ? "Create New Product" : `Edit Product: ${productName || "Product Detail Control Matrix"}`}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                serializeState();
                if (isNewProduct) {
                  // Simulate POST to save draft
                  try {
                    await fetch("/api/products", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ productName, brandName, category, status: "draft" })
                    });
                  } catch (_) {}
                  triggerToast("✓ Save Draft successfully!");
                } else {
                  // Simulate PATCH to update draft
                  try {
                    await fetch(`/api/products/${activeId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ productName, brandName, category, status: "draft" })
                    });
                  } catch (_) {}
                  triggerToast("✓ Save Changes successfully!");
                }
              }}
              id="draft-cache-btn"
              className="px-5 py-2.5 bg-white border border-[#E5E7EB] hover:bg-[#FAFAFA] text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-sm"
            >
              {isNewProduct ? "Save Draft" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handlePublishRelease}
              id="publish-profile-btn"
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all hover:scale-102 cursor-pointer shadow-md shadow-orange-500/10"
            >
              {isNewProduct ? "Publish Product" : "Update Product"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Workspace Elements Stacked and ordered exactly to requested PDF specifications */}
      <div id="workspace-layout-container" className="max-w-7xl mx-auto px-6 pt-8 space-y-6">
        <>
            {/* 1. LARGE PRODUCT MEDIA GALLERY (Hero) */}
        <div id="product-hero-card" className="bg-white border border-[#E5E7EB] rounded-3xl p-6 relative group/card shadow-sm text-left">
          
          {/* Floating Pencil Edit Trigger Card corner */}
          <button
            type="button"
            onClick={() => handleOpenDrawer("hero")}
            id="edit-hero-btn"
            className="absolute top-6 right-6 z-10 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-sm"
            title="Configure Hero Details"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
            
            {/* LEFT COLUMN: Media Viewer (60% equivalent to 6 cols) */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Active Image Window Frame with Zoom effect */}
              <div 
                className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] group select-none"
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
              >
                {images.length > 0 ? (
                  <img
                    src={images[activeImageIndex]}
                    className={`w-full h-full object-cover transition-transform duration-100 object-center ${
                      isZooming ? "scale-200 cursor-zoom-in" : "scale-100"
                    }`}
                    style={isZooming ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                    alt={productName || "Product visual catalogue detail"}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-slate-50/50 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-500/15">
                      <Plus className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="space-y-1.5 max-w-sm">
                      <h4 className="text-sm font-black text-[#1A1A2E] tracking-tight uppercase">Drag & Drop Photos</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        Drag your product photos here, or click to browse. Supports high-resolution JPG, PNG, and MP4 videos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer("hero")}
                      className="px-4 py-2 bg-[#FF5B00] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all hover:bg-orange-600 shadow-md shadow-[#FF5B00]/10 cursor-pointer active:scale-95"
                    >
                      Upload Images / Videos
                    </button>
                  </div>
                )}

                {/* Left/Right Slides Triggers Navigation */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/75 backdrop-blur-md border border-[#E5E7EB] flex items-center justify-center text-[#1A1A2E] hover:bg-white transition-opacity shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/75 backdrop-blur-md border border-[#E5E7EB] flex items-center justify-center text-[#1A1A2E] hover:bg-white transition-opacity shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Submit Sample Status flag banner corner */}
                <span className="absolute top-4 left-4 bg-[#FF5B00]/10 text-[#FF5B00] border border-[#FF5B00]/20 backdrop-blur-md text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-[#FF5B00] rounded-full animate-ping" />
                  <span>SUBMIT SAMPLE</span>
                </span>
              </div>

              {/* Grid stripe selector of Images Thumbnails */}
              {images.length > 0 && (
                <div className="flex gap-2 pb-1.5 overflow-x-auto scrollbar-thin">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        activeImageIndex === idx 
                          ? "border-orange-500 scale-102 ring-2 ring-orange-500/10" 
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <img src={img} className="w-full h-full object-cover object-center" alt="" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}

              {/* Option Selector Bubble Previews Match */}
              <div className="p-4 bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl text-left space-y-3.5">
                <span className="text-[9px] text-[#FF5B00] font-bold uppercase tracking-wider block font-mono">
                  Active Variants Specifications PREVIEW
                </span>
                
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wide mb-1">Color Option</span>
                    <div className="flex items-center gap-2">
                      {["Titanium Gray", "Cosmic Gold", "Pearl White"].map(col => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setSelectedColorOption(col)}
                          className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-semibold transition-all ${
                            selectedColorOption === col 
                              ? "bg-white border-orange-500 text-orange-600 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[9.5px] uppercase font-bold tracking-wide mb-1">Fits Dimension</span>
                    <div className="flex items-center gap-1.5">
                      {["Standard Fit", "Extra Protection Extended"].map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSizeOption(sz)}
                          className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-semibold transition-all ${
                            selectedSizeOption === sz 
                              ? "bg-white border-orange-500 text-orange-600 shadow-sm" 
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PUBLIC DISPLAY ACTION BUTTONS CONFIG */}
                <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                  <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest block font-mono mb-1.5">Configure Active Action Buttons on PDP Banner</span>
                  <div className="flex flex-wrap gap-2">
                    {actionFindInStore && (
                      <button type="button" className="px-3.5 py-1.5 bg-[#1A1A2E] text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Find in Store
                      </button>
                    )}
                    {actionBuyOnline && (
                      <button type="button" className="px-3.5 py-1.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Buy Online
                      </button>
                    )}
                    {actionLove && (
                      <button type="button" className="p-1.5 bg-rose-50 border border-rose-100 text-rose-500 rounded-xl" title="Love Product">
                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      </button>
                    )}
                    {actionWish && (
                      <button type="button" className="px-3 py-1.5 bg-[#FAFAFA] border border-slate-200 text-slate-600 rounded-xl text-[10px] uppercase font-bold">
                        Add to Wishlist
                      </button>
                    )}
                    {actionContactSeller && (
                      <button type="button" className="px-3.5 py-1.5 bg-[#FAFAFA] text-[#1A1A2E] border border-[#E5E7EB] rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Contact Seller
                      </button>
                    )}
                    {actionPreOrder && (
                      <button type="button" className="px-3.5 py-1.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Pre Order
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Specific Attributes Specifications & Stats (40% equivalent to 4 cols) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-6 lg:border-l lg:border-[#E5E7EB] lg:pl-6">
              
              <div className="space-y-4">
                {/* Breadcrumb line & SUBMIT SAMPLE Pill badge */}
                <div className="flex flex-wrap items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-[#FF5B00]">
                  <span>{brandName}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">{category}</span>
                </div>

                {/* Verified stars rating indicator for PDP header */}
                <div className="flex items-center gap-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-2.5 w-fit">
                  <div className="flex items-center gap-0.5" title="Trust Score Rating Stats">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < 4 ? "text-yellow-400 fill-yellow-400" : "text-slate-200"}`} />
                    ))}
                  </div>
                  <span className="text-xs font-black text-[#1A1A2E]">{trustRating}</span>
                  <span className="text-[10px] text-slate-400">({reviewCount} reviews)</span>
                  
                  {/* Verified PDP icon indicator */}
                  <span className="text-[8px] bg-[#50DC17]/10 text-[#2B9B00] border border-[#50DC17]/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                    VERIFIED MATCH
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl lg:text-2xl font-black text-[#1A1A2E] tracking-tight uppercase leading-none">
                    {productName}
                  </h2>
                </div>

                {/* Price display with gorgeous Saved Discount pill */}
                <div className="pt-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-black text-orange-500 font-mono">
                      ৳ {discountedPrice.toLocaleString()}
                    </span>
                    {actualPrice > discountedPrice && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        ৳ {actualPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {savingsPercent > 0 && (
                    <span className="inline-block mt-1.5 text-[9px] bg-[#50DC17]/10 text-[#2B9B00] border border-[#50DC17]/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                      {savingsPercent}% SAVED ON THE LISTING
                    </span>
                  )}
                </div>

                {/* Sourcing / Inventory summary and Product Bio paragraph */}
                <p className="text-[11.5px] text-slate-600 font-light leading-relaxed">
                  {about || "No biography provided. Click Edit to fill out descriptive story biography summaries."}
                </p>
              </div>

              {/* READ-ONLY STATS BLOCKS ROW PROTECTED WITH LOCK ICONS AND ACCESSIBILITY TOOLTIPS */}
              <div className="bg-white text-[#1A1A2E] p-4.5 rounded-2xl space-y-3.5 border border-[#E5E7EB]">
                <span className="text-[8px] text-[#EF3C23] font-mono font-black uppercase tracking-widest block border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#EF3C23]" />
                  READ-ONLY ENGAGEMENT PARAMETERS (SYSTEM CONTROLLED)
                </span>

                <div className="grid grid-cols-3 gap-2 text-center select-none">
                  {[
                    { label: "LOVES COUNT", val: lovesCount, desc: "Shopper love marks" },
                    { label: "WISHED", val: wishesCount, desc: "Saves to buyer wishlists" },
                    { label: "SESSIONS", val: viewsCount, desc: "Page views metadata" }
                  ].map((stat, i) => (
                    <div 
                      key={i} 
                      className="bg-[#f8f9fb] border border-slate-200 p-2.5 rounded-xl group/stat relative cursor-help"
                      title="Automatically calculated by Choosify backend statistics ledger."
                    >
                      <span className="text-xs font-black tracking-tight text-[#1A1A2E] font-mono block">
                        {stat.val.toLocaleString()}
                      </span>
                      <span className="text-[7.5px] text-slate-500 font-bold uppercase tracking-widest block mt-1">
                        {stat.label}
                      </span>
                      
                      {/* Interactive Tooltip representation */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-32 hidden group-hover/stat:block bg-white border border-slate-200 text-slate-700 text-[8px] p-2 rounded-lg leading-tight text-center shadow-xl z-20">
                        {stat.desc}. Automatically calculated by Choosify backend statistics engine.
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* SECTION 2: CREATOR EXPERIENCES (55% left) + PRICE ACROSS STORES TABLE (45% right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Creator experiences using reusable component */}
          <div className="lg:col-span-7">
            <CreatorExperienceSection
              contextType="product"
              contextName={productName || "Product"}
              creatorContent={creatorContent}
              onEditClick={() => handleOpenDrawer("creator")}
              onAddReviewClick={() => handleOpenDrawer("creator")}
            />
          </div>

          {/* RIGHT: Price across stores Comparative panel */}
          <div id="stores-comparison-card" className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-3xl p-6 relative shadow-sm text-left flex flex-col justify-between">
            
            {/* Top Right Floating pencil trigger */}
            <button
              type="button"
              onClick={() => handleOpenDrawer("stores")}
              id="edit-stores-list-btn"
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
              title="Edit comparative stores"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-1">
                Comparative Pricing Deals
              </span>
              <h2 className="text-base font-black uppercase tracking-wider text-[#1A1A2E] mb-4.5 flex items-center gap-2">
                PRICE ACROSS STORES 
                <span className="text-[9px] px-2 py-0.5 bg-green-100 text-[#2B9B00] border border-green-200/50 rounded-full font-bold uppercase">
                  {storeComparisonList.length} DEALS ACTIVE
                </span>
              </h2>

              {storeComparisonList.length > 0 ? (
                <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-[#FAFAFA]/20">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-slate-400 font-extrabold uppercase text-[8.5px] tracking-widest font-mono">
                        <th className="p-3">STORE LOCATION</th>
                        <th className="p-3 text-right">PRICE</th>
                        <th className="p-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {storeComparisonList.map((item, id) => (
                        <tr key={item.id || id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <span className="font-extrabold text-[#1A1A2E] block uppercase tracking-tight">{item.storeName}</span>
                            <span className="text-[9.5px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 uppercase">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.storeLocation || "Dhaka Outlet"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="text-[12.5px] font-black font-mono text-orange-500">৳{item.price.toLocaleString()}</span>
                            <span className="text-[8px] text-emerald-600 font-extrabold uppercase block mt-0.5">● {item.availability}</span>
                          </td>
                          <td className="p-3 text-right">
                            <a 
                              href={item.storeUrl || "https://choosify.bd"}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1 bg-white border border-[#E5E7EB] hover:bg-zinc-50 rounded-lg text-[9px] font-black uppercase text-slate-800 tracking-wider shadow-sm select-none inline-block hover:scale-102"
                            >
                              BUY
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
                  No competing checkout deals active for this product profile SKU.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E5E7EB]/60 mt-4.5">
              <p className="text-[10px] text-slate-400 leading-normal font-light">
                Prices and store lists synchronize in real-time. Action buttons like "Buy" or "View Deal" links are configured locally inside properties drawer.
              </p>
            </div>

          </div>

        </div>

        {/* SECTION 3: SPECIFICATIONS PARAMETERS (45% left) + PHYSICAL STORES CARDS (55% right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: Specifications Parameter Grid Table */}
          <div id="specs-card" className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-3xl p-6 relative shadow-sm text-left flex flex-col justify-between">
            
            <button
              type="button"
              onClick={() => handleOpenDrawer("specs")}
              id="edit-specs-btn"
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
              title="Edit specifications list"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-1">
                Product Core Parameters
              </span>
              <h2 className="text-base font-black uppercase tracking-wider text-[#1A1A2E] mb-4.5 text-left">
                SPECIFICATIONS
              </h2>

              {specs.length > 0 ? (
                <div className="divide-y divide-[#E5E7EB]">
                  {specs.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 text-xs">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] font-mono shrink-0 w-28 text-left">{item.key}</span>
                      <span className="text-[#1A1A2E] font-semibold text-right uppercase tracking-tight truncate max-w-[200px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
                  No attributes defined in this spec index structure.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E5E7EB]/60 mt-4.5">
              <span className="text-[9px] text-slate-400 font-mono italic">
                Sellers are advised to input verified values matching original serial parameters.
              </span>
            </div>

          </div>

          {/* RIGHT: Physical Outlets store cards */}
          <div id="physical-stores-card" className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-3xl p-6 relative shadow-sm text-left flex flex-col justify-between">
            
            <button
              type="button"
              onClick={() => handleOpenDrawer("physical-stores")}
              id="edit-physical-outlets-btn"
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
              title="Edit physical outlets list"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <div>
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-1">
                Retail Outlets Locations
              </span>
              <h2 className="text-base font-black uppercase tracking-wider text-[#1A1A2E] mb-4.5 text-left">
                PHYSICAL STORES
              </h2>

              {physicalStores.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {physicalStores.map((store, idx) => (
                    <div 
                      key={store.id || idx} 
                      className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-none hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] bg-orange-500/10 text-orange-600 border border-orange-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider leading-none">
                            {store.badgeLabel || "Premium Store"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">{store.city}</span>
                        </div>
                        <h4 className="text-xs font-black uppercase text-[#1A1A2E] tracking-wider leading-tight">
                          {store.storeName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-light leading-snug">
                          {store.address}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {store.contactNumber}
                        </span>
                        <span className="text-[8.5px] bg-slate-200/50 text-slate-600 px-1.5 py-0.5 rounded font-extrabold uppercase">
                          PICKUP AVAILABLE
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
                  No verified brick-and-mortar outlet points indexed for showcase.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E5E7EB]/60 mt-4.5">
              <span className="text-[9px] text-slate-400 font-mono">
                Store details integrate dynamically into geographic checkout lists and digital pickup options.
              </span>
            </div>

          </div>

        </div>

        {/* SECTION 4: PRODUCT OVERVIEW (Full Width Bento Grid of Bullet Feature blocks) */}
        <div id="product-overview-card" className="bg-white border border-[#E5E7EB] rounded-3xl p-6 relative shadow-sm text-left">
          
          <button
            type="button"
            onClick={() => handleOpenDrawer("overview")}
            id="edit-overview-btn"
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
            title="Configure spotlight categories"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-1">
            Visual Sourcing Storyboards
          </span>
          <h2 className="text-base font-black uppercase tracking-wider text-[#1A1A2E] mb-6 text-left">
            PRODUCT SPOTLIGHT OVERVIEW
          </h2>

          {overviewBlocks.filter(b => b.enabled).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {overviewBlocks.filter(b => b.enabled).map((blk, idx) => (
                <div 
                  key={blk.id || idx} 
                  className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-5 text-left border-l-4 border-l-orange-500 hover:shadow-sm transition-all"
                >
                  <h3 className="text-sm font-black text-[#1A1A2E] uppercase tracking-wider mb-4 border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    {blk.title}
                  </h3>
                  <ul className="space-y-2">
                    {blk.bullets.map((bullet, i) => (
                      <li key={i} className="text-xs text-slate-600 font-bold flex items-start gap-2 uppercase tracking-tight">
                        <span className="text-emerald-500 mt-0.5 select-none shrink-0 font-bold">✓</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
              No overview highlight blocks enabled.
            </div>
          )}

        </div>

        {/* SECTION 5: BEST FOR TAGS CAPSULES (Full Width) */}
        <div id="product-tags-card" className="bg-white border border-[#E5E7EB] rounded-3xl p-6 relative shadow-sm text-left">
          
          <button
            type="button"
            onClick={() => handleOpenDrawer("tags")}
            id="edit-tags-btn"
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500 hover:text-white border border-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
            title="Edit tags listing"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-1">
            Search Taxonomy Identifiers
          </span>
          <h2 className="text-base font-black uppercase tracking-wider text-[#1A1A2E] mb-4.5 text-left">
            BEST FOR TAGS CAPSULES
          </h2>

          <div className="flex flex-wrap gap-2">
            {bestForTags.length > 0 ? (
              bestForTags.map((tag, idx) => (
                <span 
                  key={idx} 
                  className="px-4 py-2.5 bg-orange-50 text-[#FF5B00] border border-orange-100 rounded-2xl text-[10.5px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm"
                >
                  <span>★</span>
                  <span>{tag}</span>
                </span>
              ))
            ) : (
              <div className="py-6 w-full border border-dashed border-[#E5E7EB] rounded-2xl bg-[#FAFAFA]/50 text-center text-slate-400 text-xs italic">
                No taxonomy tagging configured. Click Edit on the top right to begin adding custom search tags.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]/50 mt-6 text-slate-400 text-[10px] font-mono leading-none">
            Tag parameters automatically index listings across search modules and personalized category collections.
          </div>

        </div>
        </>
      </div>

      {/* RIGHT SLIDING PROPERTY DRAWER PANEL (Width: 480px) */}
      <AnimatePresence>
        {activeDrawer && (
          <div className="fixed inset-0 z-[400] overflow-hidden">
            {/* Backdrop Blur screen layer with click close trigger */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="absolute inset-0 bg-[#1A1A2E]/80 backdrop-blur-sm cursor-pointer" 
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="w-screen max-w-md bg-white text-[#1A1A2E] shadow-2xl flex flex-col justify-between text-left border-l border-[#E5E7EB]"
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-[#E5E7EB] bg-[#FAFAFA]">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-orange-500 font-mono font-black uppercase tracking-wider block mb-1">
                        Sellers Configuration drawer
                      </span>
                      <h3 className="text-sm font-black uppercase text-[#1A1A2E] tracking-wider">
                        Configure Section parameters
                      </h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveDrawer(null)}
                      className="text-slate-400 hover:text-slate-900 border-0 bg-transparent text-xs font-black font-mono tracking-widest cursor-pointer px-2.5 py-1.5 hover:bg-slate-100 rounded-xl"
                    >
                      X CLOSE
                    </button>
                  </div>
                </div>

                {/* Drawer Scroll Container */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">

                  {/* FORM 1: HEROS MODULE ATTRS */}
                  {activeDrawer === "hero" && (
                    <div className="space-y-4">
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product Catalog SKU Name</label>
                        <input 
                          value={productName}
                          onChange={(e) => setProductName(e.target.value)}
                          className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 font-bold uppercase font-mono"
                          placeholder="SAMSUNG S25 ULTRA BD..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Brand Label</label>
                          <input 
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 bg-white py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 font-black uppercase"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Breadcrumb Group</label>
                          <input 
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 bg-white py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 font-black uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Actual Price (৳)</label>
                          <input 
                            type="number"
                            value={actualPrice}
                            onChange={(e) => setActualPrice(Number(e.target.value))}
                            className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Sale price (৳)</label>
                          <input 
                            type="number"
                            value={discountedPrice}
                            onChange={(e) => setDiscountedPrice(Number(e.target.value))}
                            className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Product bio about</label>
                        <textarea 
                          rows={3}
                          value={about}
                          onChange={(e) => setAbout(e.target.value)}
                          className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-xs text-[#1A1A2E] outline-none focus:border-orange-500 resize-none font-medium leading-relaxed"
                        />
                      </div>

                      {/* Photo List editing nodes inside Hero */}
                      <div className="space-y-2.5 pt-3 border-t border-[#E5E7EB]">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Modify Photos Grid</span>
                        {images.map((img, i) => (
                          <div key={i} className="flex gap-2">
                            <input 
                              value={img}
                              onChange={(e) => {
                                const copy = [...images];
                                copy[i] = e.target.value;
                                setImages(copy);
                              }}
                              className="w-full bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs truncate text-[#1A1A2E] outline-none focus:border-orange-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                              className="p-2.5 bg-red-100/40 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <input 
                            value={tempImagesInput}
                            onChange={(e) => setTempImagesInput(e.target.value)}
                            placeholder="Add photo HTTPS url listings row..."
                            className="flex-1 bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#1A1A2E] outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (tempImagesInput.trim()) {
                                setImages([...images, tempImagesInput.trim()]);
                                setTempImagesInput("");
                              }
                            }}
                            className="px-4 bg-orange-500 text-white rounded-xl text-xs font-black uppercase"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Action buttons toggles config */}
                      <div className="space-y-2.5 pt-4 border-t border-[#E5E7EB] text-xs font-bold text-slate-600">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Enabled Interactive Checkout Actions</span>
                        {[
                          { l: "Enable 'FIND IN STORE' Map search trigger", v: actionFindInStore, s: setActionFindInStore },
                          { l: "Enable 'BUY ONLINE' direct portal", v: actionBuyOnline, s: setActionBuyOnline },
                          { l: "Enable 'HEART LOVE' stats counter", v: actionLove, s: setActionLove },
                          { l: "Enable 'WISHLIST' catalog bookmarking", v: actionWish, s: setActionWish },
                          { l: "Enable 'DIGITAL CHAT WITH SELLER' assistant", v: actionContactSeller, s: setActionContactSeller },
                          { l: "Enable 'REQUEST BULK QUOTE' document module", v: actionRequestQuote, s: setActionRequestQuote },
                          { l: "Enable 'PRE ORDER' billing toggle", v: actionPreOrder, s: setActionPreOrder }
                        ].map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-[#E5E7EB]/40">
                            <span>{item.l}</span>
                            <input 
                              type="checkbox" 
                              checked={item.v}
                              onChange={(e) => item.s(e.target.checked)}
                              className="rounded border-[#E5E7EB] text-orange-500 focus:ring-orange-500"
                            />
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* FORM 2: CREATOR CONTENT SOURCING PANEL */}
                  {activeDrawer === "creator" && (
                    <div className="space-y-4">
                      
                      <p className="text-[10.5px] italic text-slate-500 leading-normal mb-2">
                        Configure digital creators highlights list. Reorder, add creator clips reviews, remove items, or mark specific item as top spotlight features card.
                      </p>

                      <div className="space-y-4 pr-1">
                        {creatorContent.map((item) => (
                          <div key={item.id} className="bg-[#FAFAFA] border border-[#E5E7EB] p-3.5 rounded-2xl relative text-left text-xs space-y-2.5">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                              <span className="font-extrabold text-orange-500 text-[10px] font-mono">@{item.creatorHandle}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = creatorContent.map(c => ({
                                      ...c,
                                      isFeatured: c.id === item.id
                                    }));
                                    setCreatorContent(updated);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest leading-none ${
                                    item.isFeatured ? "bg-orange-500 text-white" : "bg-white hover:bg-slate-200 text-slate-500 border border-slate-200"
                                  }`}
                                >
                                  {item.isFeatured ? "Spotlight" : "Feature"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCreatorContent(creatorContent.filter(c => c.id !== item.id))}
                                  className="text-red-500 hover:text-red-700 font-bold"
                                  title="Delete Review"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest block">Review title</span>
                              <input 
                                value={item.title}
                                onChange={(e) => {
                                  const updated = creatorContent.map(c => c.id === item.id ? { ...c, title: e.target.value } : c);
                                  setCreatorContent(updated);
                                }}
                                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 text-[11px] text-[#1A1A2E] outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-[7.5px] uppercase font-black text-slate-400 font-mono tracking-widest">Platform</span>
                                <select
                                  value={item.platform}
                                  onChange={(e) => {
                                    const updated = creatorContent.map(c => c.id === item.id ? { ...c, platform: e.target.value } : c);
                                    setCreatorContent(updated);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 outline-none font-bold"
                                >
                                  <option value="YOUTUBE">YouTube</option>
                                  <option value="INSTAGRAM">Instagram</option>
                                  <option value="TIKTOK">TikTok</option>
                                  <option value="FACEBOOK">Facebook</option>
                                </select>
                              </div>
                              <div>
                                <span className="text-[7.5px] uppercase font-black text-slate-400 font-mono tracking-widest">Duration</span>
                                <input 
                                  value={item.duration}
                                  onChange={(e) => {
                                    const updated = creatorContent.map(c => c.id === item.id ? { ...c, duration: e.target.value } : c);
                                    setCreatorContent(updated);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Creator Clip trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          const fresh: CreatorContentItem = {
                            id: `cc-${Date.now()}`,
                            platform: "YOUTUBE",
                            videoUrl: "https://youtube.com/watch?v=fresh",
                            thumbnail: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
                            title: "Brand New Unboxing Clip Review",
                            description: "Review of the brand specs and details.",
                            views: 1300,
                            likes: 120,
                            duration: "4:50",
                            creatorHandle: "FreshTechMaker",
                            creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50",
                            location: "Dhaka, BD",
                            isFeatured: false
                          };
                          setCreatorContent([...creatorContent, fresh]);
                        }}
                        className="w-full py-3 border border-dashed border-[#E5E7EB] rounded-2xl text-[10px] text-orange-500 font-bold uppercase tracking-widest hover:bg-orange-50/10 hover:border-orange-500/50 transition-colors cursor-pointer"
                      >
                        + ADD CREATOR REVIEWS SLOT
                      </button>

                    </div>
                  )}

                  {/* FORM 3: PRICE ACROSS STORES */}
                  {activeDrawer === "stores" && (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 block font-mono">Store comparative values</span>
                      
                      <div className="space-y-3.5">
                        {tempStores.map((item, id) => (
                          <div key={item.id || id} className="bg-[#FAFAFA] border border-[#E5E7EB] p-3.5 rounded-2xl space-y-2 relative text-left text-xs">
                            <button
                              type="button"
                              onClick={() => setTempStores(tempStores.filter((_, idx) => idx !== id))}
                              className="absolute top-3.5 right-3.5 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="space-y-1">
                              <label className="text-[7.5px] uppercase font-bold text-slate-400">Store Name</label>
                              <input 
                                value={item.storeName}
                                onChange={(e) => {
                                  const copy = [...tempStores];
                                  copy[id] = { ...copy[id], storeName: e.target.value };
                                  setTempStores(copy);
                                }}
                                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <label className="text-[7.5px] uppercase font-bold text-slate-400">Price (৳)</label>
                                <input 
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => {
                                    const copy = [...tempStores];
                                    copy[id] = { ...copy[id], price: Number(e.target.value) };
                                    setTempStores(copy);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[7.5px] uppercase font-bold text-slate-400">Location Area</label>
                                <input 
                                  value={item.storeLocation || ""}
                                  onChange={(e) => {
                                    const copy = [...tempStores];
                                    copy[id] = { ...copy[id], storeLocation: e.target.value };
                                    setTempStores(copy);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const fresh: StoreListing = {
                            id: `sl-${Date.now()}`,
                            storeName: "Star Tech BD",
                            price: 148000,
                            availability: "In Stock",
                            storeRating: 4.8,
                            storeUrl: "https://startech.com.bd",
                            storeLocation: "Dhaka Mall"
                          };
                          setTempStores([...tempStores, fresh]);
                        }}
                        className="w-full py-2 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[10px] font-black uppercase text-slate-600 tracking-wider hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        + Add price comparisons Store
                      </button>

                    </div>
                  )}

                  {activeDrawer === "specs" && (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 block font-mono">Parameters Specifications Attributes</span>
                      
                      <div className="space-y-2 text-left">
                        {tempSpecs.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center bg-[#FAFAFA] p-2 rounded-xl border border-slate-150 relative">
                            <div className="grid grid-cols-2 gap-2 flex-grow text-xs font-mono">
                              <input 
                                value={item.key}
                                onChange={(e) => {
                                  const copy = [...tempSpecs];
                                  copy[idx].key = e.target.value;
                                  setTempSpecs(copy);
                                }}
                                className="bg-transparent border-0 outline-none uppercase font-bold text-slate-500 py-1"
                                placeholder="Attribute key"
                              />
                              <input 
                                value={item.value}
                                onChange={(e) => {
                                  const copy = [...tempSpecs];
                                  copy[idx].value = e.target.value;
                                  setTempSpecs(copy);
                                }}
                                className="bg-transparent border-0 outline-none font-bold text-[#1A1A2E] py-1"
                                placeholder="Value"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setTempSpecs(tempSpecs.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setTempSpecs([...tempSpecs, { key: "New Parameter", value: "New Value" }])}
                        className="w-full py-2.5 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[9.5px] font-bold uppercase hover:bg-slate-100 tracking-widest text-slate-600 cursor-pointer"
                      >
                        + ADD NEW ROW
                      </button>

                    </div>
                  )}

                  {/* FORM 5: PHYSICAL OUTLETS STORES */}
                  {activeDrawer === "physical-stores" && (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 block font-mono">Physical stores outlets</span>
                      
                      <div className="space-y-4 select-none">
                        {tempPhysicalStores.map((item, idx) => (
                          <div key={item.id || idx} className="bg-[#FAFAFA] border border-[#E5E7EB] p-4 rounded-2xl relative text-left text-xs space-y-3">
                            <button
                              type="button"
                              onClick={() => setTempPhysicalStores(tempPhysicalStores.filter((_, i) => i !== idx))}
                              className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="space-y-1">
                              <label className="text-[7.5px] uppercase font-bold text-slate-400">Outlet Sourcing Point Name</label>
                              <input 
                                value={item.storeName}
                                onChange={(e) => {
                                  const copy = [...tempPhysicalStores];
                                  copy[idx] = { ...copy[idx], storeName: e.target.value };
                                  setTempPhysicalStores(copy);
                                }}
                                className="w-full bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 focus:border-orange-500 outline-none uppercase font-bold"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[7.5px] uppercase font-bold text-slate-400">Street Address</label>
                              <input 
                                value={item.address}
                                onChange={(e) => {
                                  const copy = [...tempPhysicalStores];
                                  copy[idx] = { ...copy[idx], address: e.target.value };
                                  setTempPhysicalStores(copy);
                                }}
                                className="w-full bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 focus:border-orange-500 outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <label className="text-[7.5px] uppercase font-bold text-slate-400">City</label>
                                <input 
                                  value={item.city}
                                  onChange={(e) => {
                                    const copy = [...tempPhysicalStores];
                                    copy[idx] = { ...copy[idx], city: e.target.value };
                                    setTempPhysicalStores(copy);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 outline-none uppercase font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[7.5px] uppercase font-bold text-slate-400">Outlet Badge Tag</label>
                                <select
                                  value={item.badgeLabel}
                                  onChange={(e) => {
                                    const copy = [...tempPhysicalStores];
                                    copy[idx] = { ...copy[idx], badgeLabel: e.target.value };
                                    setTempPhysicalStores(copy);
                                  }}
                                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-1.5 outline-none font-bold"
                                >
                                  <option value="Flagship">Flagship Outlet</option>
                                  <option value="Premium">Premium Center</option>
                                  <option value="Authorized">Authorized Store</option>
                                  <option value="Express Pickup">Express Pickup Hub</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const fresh: PhysicalStore = {
                            id: `ps-${Date.now()}`,
                            storeName: "Star Tech Multi-Outlet",
                            address: "10th Floor, Mascot Plaza, Uttara",
                            badgeLabel: "Authorized",
                            contactNumber: "+8801711223355",
                            city: "Dhaka"
                          };
                          setTempPhysicalStores([...tempPhysicalStores, fresh]);
                        }}
                        className="w-full py-3 bg-[#FAFAFA] border border-dashed border-[#E5E7EB] hover:bg-slate-100 rounded-2xl text-[10px] text-orange-500 font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        + Add Retail Store Point
                      </button>

                    </div>
                  )}

                  {/* FORM 6: PRODUCT OVERVIEW */}
                  {activeDrawer === "overview" && (
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-black text-slate-400 block font-mono">Overview Category Spotlight grids</span>
                      
                      <div className="space-y-4">
                        {tempOverview.map((blk, idx) => (
                          <div key={blk.id || idx} className="bg-[#FAFAFA] border border-[#E5E7EB] p-4 rounded-2xl space-y-3 relative text-left text-xs">
                            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-150">
                              <span className="font-extrabold text-orange-600 uppercase tracking-tight">{blk.title}</span>
                              <div className="flex items-center gap-1.5">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const copy = [...tempOverview];
                                    copy[idx].enabled = !copy[idx].enabled;
                                    setTempOverview(copy);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    blk.enabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {blk.enabled ? "ON" : "OFF"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTempOverview(tempOverview.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 font-bold ml-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {blk.enabled && (
                              <div className="space-y-2 text-[10px]">
                                <span className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-widest block">Highlight Bullets List</span>
                                {blk.bullets.map((bullet, bIdx) => (
                                  <div key={bIdx} className="flex gap-1.5">
                                    <input 
                                      value={bullet}
                                      onChange={(e) => {
                                        const copy = [...tempOverview];
                                        copy[idx].bullets[bIdx] = e.target.value;
                                        setTempOverview(copy);
                                      }}
                                      className="flex-grow bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1 uppercase font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = [...tempOverview];
                                        copy[idx].bullets = copy[idx].bullets.filter((_, bSub) => bSub !== bIdx);
                                        setTempOverview(copy);
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold font-mono px-1"
                                    >
                                      x
                                    </button>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...tempOverview];
                                    copy[idx].bullets.push("NEW BULLET POINTER VALUE");
                                    setTempOverview(copy);
                                  }}
                                  className="text-orange-500 hover:underline text-[9.5px] font-black uppercase tracking-wider block pt-1 text-left"
                                >
                                  + ADD UNIQUE BULLET BLOCK
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const fresh: OverviewBlock = {
                            id: `ob-${Date.now()}`,
                            title: "New Spotlight Block",
                            bullets: ["FIRST DEFAULT VALUE BENCHMARK PRO"],
                            enabled: true
                          };
                          setTempOverview([...tempOverview, fresh]);
                        }}
                        className="w-full py-3 bg-[#FAFAFA] border border-dashed border-[#E5E7EB] hover:bg-slate-100 rounded-2xl text-[10px] text-orange-500 font-bold uppercase tracking-widest cursor-pointer transition-colors"
                      >
                        + Add Spotlight Story block
                      </button>

                    </div>
                  )}

                  {/* FORM 7: BEST FOR TAGS */}
                  {activeDrawer === "tags" && (
                    <div className="space-y-4">
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        {tempTagsList.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className="px-3 py-1.5 bg-orange-100 text-orange-700 border border-orange-200/50 rounded-lg text-[10.5px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => setTempTagsList(tempTagsList.filter((_, i) => i !== idx))}
                              className="text-red-500 group-hover:text-red-700 font-bold text-xs"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Add dynamic capsule search */}
                      <div className="space-y-2 text-xs">
                        <label className="text-[10px] uppercase font-black text-slate-400 block font-mono">Input dynamic capsule tag</label>
                        <div className="flex gap-2">
                          <input 
                            value={newTagVal}
                            onChange={(e) => setNewTagVal(e.target.value)}
                            placeholder="e.g. durable leather casing, premium..."
                            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs flex-grow outline-none focus:border-orange-500 uppercase font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newTagVal.trim() && !tempTagsList.includes(newTagVal.trim().toLowerCase())) {
                                setTempTagsList([...tempTagsList, newTagVal.trim().toLowerCase()]);
                                setNewTagVal("");
                              }
                            }}
                            className="px-4 bg-orange-500 text-white rounded-xl font-bold uppercase text-[10.5px]"
                          >
                            Add tag
                          </button>
                        </div>

                        {/* Autocomplete recommended list */}
                        <div className="pt-2 border-t border-[#E5E7EB]">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400 block tracking-widest font-mono mb-2">Recommended preset tags</span>
                          <div className="flex flex-wrap gap-1.5">
                            {["eco-friendly packaging", "premium lifestyle", "modern classic apparel", "high benchmarks zoom"].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  if (!tempTagsList.includes(preset)) {
                                    setTempTagsList([...tempTagsList, preset]);
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[9.5px] text-slate-600 uppercase font-semibold transition-colors"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

                {/* Drawer Sticky Save Changes footer matches "save independently, success toast, automatic close" */}
                <div className="p-6 border-t border-[#E5E7EB] bg-[#FAFAFA]" id="drawer-save-box">
                  <button
                    type="button"
                    onClick={() => handleSaveSection(activeDrawer || "")}
                    id="save-changes-btn"
                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all hover:scale-101 active:scale-99 shadow-md shadow-orange-500/10 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>

              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
