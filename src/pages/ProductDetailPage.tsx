import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronRight, X } from "lucide-react";
import { ProductDetailView, ProductData } from "../components/ProductDetailView";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80";

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
      "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80"
    ],
    tags: ["#PremiumQuality", "#SamsungS25", "#TechTrend"],
    about: "The ultimate power flag-ship device designed for elites. Includes robust Snapdragon processor, high precision screen matrix and exclusive AI assistant suites.",
    pros: ["Elite peak chip processing", "Incredible night photography zoom", "Exclusive 1 year official care guarantee"],
    cons: ["Premium tier pricing", "Heavier display weight footprint"],
    specs: [
      { key: "Processor", value: "Snapdragon 8 Elite Gen 4" },
      { key: "RAM", value: "16GB LPDDR5X" },
      { key: "Screen", value: "6.9\" Dynamic OLED 120Hz" },
      { key: "Battery", value: "5400 mAh with 60W charge" }
    ],
    storeAvailability: "Available at Dhanmondi, Banani, and Jamuna Future Park stores.",
    returnPolicy: "Official 7-day replacement and 1-year brand support warranty.",
    deliveryInfo: "Next-day Express home shipping inside Dhaka metropolitan."
  },
  "2": {
    brandName: "Vision",
    productName: 'Vision Smart TV 55"',
    category: "Electronics",
    actualPrice: 75000,
    discountedPrice: 68500,
    stockLimit: 30,
    soldCount: 8,
    images: [
      "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&q=80"
    ],
    tags: ["#SmartTV", "#BigScreen", "#HomeCinema"],
    about: "Immersive 4K smart television with voice controls and built-in legal streaming app arrays.",
    pros: ["Brilliant pure color reproduction", "Robust soundbar audio depth", "Full Android TV operating setup"],
    cons: ["Requires high room illumination to reduce glare"],
    specs: [
      { key: "Display Panel", value: "4K ultra premium IPS 120Hz" },
      { key: "System Core", value: "Android TV 14 Google Play Store" },
      { key: "Audio Setup", value: "Dolby Atmos 40W Quad Speakers" }
    ],
    storeAvailability: "Available BD wide at verified Vision Dealer hubs.",
    returnPolicy: "Vision 2-year screen replacement and service backing.",
    deliveryInfo: "Home package setup with professional wall hangers included."
  },
  "3": {
    brandName: "Aarong",
    productName: "Aarong Jamdani Saree",
    category: "Fashion",
    actualPrice: 5000,
    discountedPrice: 4200,
    stockLimit: 120,
    soldCount: 45,
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80"
    ],
    tags: ["#Heritage", "#Jamdani", "#Traditional"],
    about: "Woven meticulously by local artisan master craftsmen in Dhaka. Elegant, comfortable and carries beautiful legacy heritage design aesthetics.",
    pros: ["Authentic handwoven cotton threads", "Super light-weight breathable texture", "Classic Royal Jamdani pattern weaves"],
    cons: ["Requires manual premium dry cleansing only"],
    specs: [
      { key: "Artisan Zone", value: "Sonargaon Weaving Cluster" },
      { key: "Color", value: "Midnight Navy Indigo" },
      { key: "Fabric", value: "Pure Premium Cotton Georgette" }
    ],
    storeAvailability: "Sourced through Aarong outlets and verified digital app stores.",
    returnPolicy: "Original tags with untouched box can be returned in 15 days.",
    deliveryInfo: "Craft boxed wrapping and secured shipping within 48 hours."
  },
  "4": {
    brandName: "Walton",
    productName: "Walton 2-Door Fridge",
    category: "Home",
    actualPrice: 35000,
    discountedPrice: 29990,
    stockLimit: 40,
    soldCount: 15,
    images: [
      "https://images.unsplash.com/photo-1571175432244-5f0258591f87?w=800&q=80"
    ],
    tags: ["#SmartCooling", "#WaltonBD", "#EcoFriendly"],
    about: "Double-door energy saving refrigerator designed to prevent frost accumulation with robust structural backing.",
    pros: ["Extremely quiet inverter compressor", "Highest 5-Star eco energy efficiency", "Tough tempered safety glass shelves"],
    cons: ["Slightly wider size footprint"],
    specs: [
      { key: "Capacity", value: "320 Litres net usable volume" },
      { key: "Technology", value: "Intelligent Non-Frost Inverter" },
      { key: "Warranty", value: "10-Year Inverter Compressor Warranty" }
    ],
    storeAvailability: "Available at Walton Plazas BD-wide.",
    returnPolicy: "Plaza 30-day structural guarantee.",
    deliveryInfo: "Ground floor home carriage and setup included inside Dhaka."
  }
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductData | null>(null);
  
  // Checkout drawer simulation
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);
  const [checkoutNotes, setCheckoutNotes] = useState("Assalamu alaikum. Please deliver the package with authentic packing intact. Contact me before delivery.");
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    // Single Source of Truth loading pattern:
    // First check published state, then check draft state, then fall back to default mock data
    const publishKey = `choosify_published_${id || "1"}`;
    const draftKey = `choosify_draft_${id || "1"}`;
    
    let activeData = null;
    const published = localStorage.getItem(publishKey);
    if (published) {
      try {
        activeData = JSON.parse(published);
      } catch (_) {}
    }

    if (!activeData) {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        try {
          activeData = JSON.parse(draft);
        } catch (_) {}
      }
    }

    if (!activeData) {
      activeData = mockProductDetails[id || "1"] || mockProductDetails["1"];
    }

    setProduct(activeData);
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center p-8 text-white">
        <span className="font-mono text-[10px] uppercase tracking-[4px] animate-pulse">Loading Product Catalog...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Mini Customer Page Navbar Header banner */}
      <div className="bg-slate-900 text-white/50 text-[10px] uppercase tracking-wider py-3 px-6 h-12 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-white hover:text-app-accent flex items-center gap-1">
            <ArrowLeft size={12} className="text-white shrink-0" />
            <span className="font-bold">Home</span>
          </Link>
          <ChevronRight size={10} className="text-white/20" />
          <span className="text-white/30 font-semibold">{product.brandName}</span>
        </div>
        <div className="text-right">
          <span className="bg-app-accent text-white px-2.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest leading-none">
            CUSTOMER ENDPAGE
          </span>
        </div>
      </div>

      {/* Shared Unified Detail View */}
      <ProductDetailView 
        data={product} 
        mode="view" 
        onTriggerOrder={() => setShowCheckoutDrawer(true)}
      />

      {/* Simulated Trust Checkout Drawer */}
      {showCheckoutDrawer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 antialiased">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCheckoutDrawer(false)} />
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-3xl text-left space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-app-accent px-3 py-0.5 bg-app-accent/5 border border-app-accent/15 rounded-full">Secure Sourcing Gateway</span>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-2.5">Confirm Your Sourcing Order</h3>
              </div>
              <button 
                onClick={() => setShowCheckoutDrawer(false)} 
                type="button" 
                className="p-2 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 p-4.5 bg-slate-50 border border-slate-150 rounded-2xl">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-white p-1 flex items-center justify-center">
                <img src={product.images?.[0] || PLACEHOLDER_IMAGE} className="max-w-full max-h-full object-contain" alt="" />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <h4 className="font-black text-slate-900 truncate">{product.productName}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{product.brandName} • {product.category}</p>
                <div className="text-xs font-black text-app-accent mt-2">Price: BDT ৳{product.discountedPrice.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Add Delivery & Handling Notes</label>
                <textarea 
                  rows={3}
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-800 font-medium outline-none focus:border-app-accent outline-0 resize-none leading-relaxed"
                />
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                  <span className="font-black text-slate-900 block mb-0.5">Order-Linked Inbox Generation</span>
                  Sourcing checkout sends an authentic order ticket to the brand channel for swift verification and home carrying dispatch.
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setShowCheckoutDrawer(false)}
                className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowCheckoutDrawer(false);
                  setShowSuccessToast(true);
                  setTimeout(() => setShowSuccessToast(false), 8000);
                }}
                className="px-8 py-3 bg-app-accent hover:bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 cursor-pointer"
              >
                Place Trust Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 left-6 z-[110] max-w-sm bg-slate-900 border border-emerald-500/20 text-white rounded-3xl p-5 shadow-2xl flex items-start gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Purchase Order Placed!</h4>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Order request forwarded successfully! Open <strong>“My Dashboard”</strong> and head to the <strong>Inbox</strong> or <strong>Orders</strong> tracking console to view real-time log.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
