import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Play, 
  ShoppingBag, 
  Award, 
  Tag, 
  Heart, 
  BookOpen,
  Info
} from 'lucide-react';
import { CMSData, CMSSection } from '../contexts/CMSDataContext';

// Define clean types matching core props
export interface Product {
  id: string;
  name: string;
  brand: string;
  category?: string;
  price: string;
  rating?: number;
  image: string;
  badge?: string;
  isSponsored?: boolean;
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  category?: string;
  rating?: number;
  verified?: boolean;
}

export interface Creator {
  id: string;
  name: string;
  avatar: string;
  followers: string;
  category?: string;
  engagement?: string;
  verified?: boolean;
}

export interface Deal {
  id: string;
  name: string;
  discount: string;
  seller: string;
  image: string;
  expiry: string;
}

export interface Guide {
  id: string;
  title: string;
  creator: string;
  image: string;
  reads?: string;
  tag?: string;
  type?: 'reel' | 'blog' | 'video' | string;
}

export interface CMSLivePreviewProps {
  cmsData: CMSData;
  products?: Product[];
  brands?: Brand[];
  creators?: Creator[];
  deals?: Deal[];
  guides?: Guide[];
}

// Preloaded beautiful defaults to ensure zero-blank rendering
const FALLBACK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Samsung S25 Ultra', brand: 'Samsung Bangladesh', category: 'Mobile', price: '৳ 139,999', rating: 4.9, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', badge: 'Hot Seller' },
  { id: 'p2', name: 'Vision Smart TV 55"', brand: 'Vision', category: 'Electronics', price: '৳ 68,500', rating: 4.7, image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&q=80', badge: 'Popular' },
  { id: 'p3', name: 'Aarong Jamdani Saree', brand: 'Aarong', category: 'Fashion', price: '৳ 4,200', rating: 4.8, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80', badge: 'Authentic' },
  { id: 'p4', name: 'Walton 2-Door Fridge', brand: 'Walton', category: 'Home', price: '৳ 29,990', rating: 4.5, image: 'https://images.unsplash.com/photo-1571175432247-50a2e4c6bb77?w=400&q=80' },
  { id: 'p5', name: 'Apex Men Royal Loafer', brand: 'Apex', category: 'Footwear', price: '৳ 4,500', rating: 4.6, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80', badge: 'Premium' },
  { id: 'p6', name: 'Urban Fit Elite Compression Tee', brand: 'Urban Fit', category: 'Active Wear', price: '৳ 1,800', rating: 4.7, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&q=80' },
  { id: 'p7', name: 'TechCore Wireless Charging Pad', brand: 'TechCore', category: 'Consumer Tech', price: '৳ 1,200', rating: 4.4, image: 'https://images.unsplash.com/photo-1622445262465-2481c4574875?w=400&q=80' },
  { id: 'p8', name: 'TechCore Bluetooth Watch V2', brand: 'TechCore', category: 'Consumer Tech', price: '৳ 3,800', rating: 4.5, image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&q=80' },
];

const FALLBACK_BRANDS: Brand[] = [
  { id: 'b1', name: 'Apex Footwear', logo: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=100&q=80', category: 'Footwear & Apparel', rating: 4.8, verified: true },
  { id: 'b2', name: 'Walton Appliances', logo: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100&q=80', category: 'Electronics & Home', rating: 4.5, verified: true },
  { id: 'b3', name: 'Aarong Handcrafts', logo: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=100&q=80', category: 'Fashion Heritage', rating: 4.9, verified: true },
  { id: 'b4', name: 'Samsung Bangladesh', logo: 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=100&q=80', category: 'Consumer Tech', rating: 4.9, verified: true },
  { id: 'b5', name: 'Sailor clothing', logo: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=100&q=80', category: 'Apparel & Lifestyle', rating: 4.7, verified: true },
  { id: 'b6', name: 'Urban Fit active', logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=100&q=80', category: 'Active Wear', rating: 4.6, verified: true },
];

const FALLBACK_DEALS: Deal[] = [
  { id: 'd1', name: 'Eid Mega Tech Voucher 2026', discount: '30% OFF', seller: 'TechZone BD', image: 'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?w=400&q=80', expiry: '12 days left' },
  { id: 'd2', name: 'Walton AC Summer Cooling Flash', discount: '40% OFF', seller: 'ElectroBD', image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80', expiry: '18 hours left' },
  { id: 'd3', name: 'Aarong Jamdani Weekend Special', discount: '20% OFF', seller: 'Aarong Digital', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80', expiry: '2 days left' },
];

const FALLBACK_CREATORS: Creator[] = [
  { id: 'c1', name: 'Rafsan The Chotobhai', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80', followers: '1.2M', category: 'Food & Lifestyle', engagement: '8.4%', verified: true },
  { id: 'c2', name: 'Tawhid Afridi', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80', followers: '2.5M', category: 'Vlogs & Tech', engagement: '11.2%', verified: true },
  { id: 'c3', name: 'Nadia Akter', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80', followers: '450K', category: 'Fashion & Beauty', engagement: '6.7%', verified: true },
  { id: 'c4', name: 'SamZone tech', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80', followers: '850K', category: 'Tech & Gadgets', engagement: '9.1%', verified: true },
];

const FALLBACK_RECOMMENDATIONS: Guide[] = [
  { id: 'rec1', title: 'Ultimate Panjabi Buying Guide for Eid 2026', creator: 'Rafsan The Chotobhai', reads: '12.4K reads', image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&q=80', tag: 'Eid Fashion', type: 'blog' },
  { id: 'rec2', title: 'Top Budget-Friendly Refrigerator Matches in BD', creator: 'SamZone tech', reads: '8.1K reads', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80', tag: 'Home Tech', type: 'video' },
  { id: 'rec3', title: 'Premium Leather Shoes For High-Profile Formal Wear', creator: 'Tawhid Afridi', reads: '5.9K reads', image: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=400&q=80', tag: 'Footwear', type: 'video' },
];

const FALLBACK_ADS = [
  { id: 'promo_banner_01', title: 'Walton Smart Cooling AC Campaign', brand: 'Walton Bangladesh', link: '/brand/walton', image: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&q=80', badge: 'SUMMER COOLING' },
  { id: 'promo_deal_01', title: 'Apex Eid Loafer Premium Launch Showcase', brand: 'Apex Footwear', link: '/brand/apex', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', badge: 'EID EXCLUSIVE' },
];

export default function CMSLivePreview({
  cmsData,
  products = [],
  brands = [],
  creators = [],
  deals = [],
  guides = []
}: CMSLivePreviewProps) {

  // Ad banner state control
  const [adIndex, setAdIndex] = useState(0);

  // Helper 2: Fetch and align actual hydrated items by IDs from section rules
  const getItemsForSection = (
    section: CMSSection, 
    itemType: 'product' | 'brand' | 'creator' | 'deal' | 'guide' | 'ad'
  ): any[] => {
    const ids = section.itemIds || [];
    
    if (itemType === 'product') {
      const allPrd = [...products, ...FALLBACK_PRODUCTS];
      return ids.map(id => allPrd.find(x => x.id === id)).filter((x): x is Product => !!x);
    }
    if (itemType === 'brand') {
      const allBrnd = [...brands, ...FALLBACK_BRANDS];
      return ids.map(id => allBrnd.find(x => x.id === id)).filter((x): x is Brand => !!x);
    }
    if (itemType === 'creator') {
      const allCrt = [...creators, ...FALLBACK_CREATORS];
      return ids.map(id => allCrt.find(x => x.id === id)).filter((x): x is Creator => !!x);
    }
    if (itemType === 'deal') {
      const allDl = [...deals, ...FALLBACK_DEALS];
      return ids.map(id => allDl.find(x => x.id === id)).filter((x): x is Deal => !!x);
    }
    if (itemType === 'guide') {
      const allG = [...guides, ...FALLBACK_RECOMMENDATIONS];
      return ids.map(id => allG.find(x => x.id === id)).filter((x): x is Guide => !!x);
    }
    if (itemType === 'ad') {
      return ids.map(id => FALLBACK_ADS.find(x => x.id === id)).filter(x => !!x);
    }
    return [];
  };

  // Sort sections vertically based on order sequence
  const activeSortedSections = Object.values(cmsData)
    .filter((sec: CMSSection) => sec.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 md:p-8 space-y-10 shadow-sm max-w-7xl mx-auto">
      
      {/* Choosify Authentic Portal Branding Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EF3C23] flex items-center justify-center font-black text-white text-lg shadow-md shadow-red-500/20 tracking-tighter">
            C
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">Choosify Bangladesh</h2>
              <span className="bg-emerald-500/10 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                Live Preview
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Real-time local retail curation channel</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider">PREVIEW REGION</p>
          <p className="text-xs font-bold text-slate-700 mt-0.5">Desktop & Mobile Fluid Grid</p>
        </div>
      </div>

      {/* Stacked Interactive Sections */}
      <div className="space-y-12">
        {activeSortedSections.map((section) => {
          const itemType = 
            section.id.toLowerCase().includes('deal') ? 'deal' :
            section.id.toLowerCase().includes('brand') ? 'brand' :
            section.id.toLowerCase().includes('creator') ? 'creator' :
            section.id.toLowerCase().includes('product') ? 'product' :
            section.id.toLowerCase().includes('recommendation') ? 'guide' :
            section.id.toLowerCase().includes('ad') ? 'ad' : 'product';

          const items = getItemsForSection(section, itemType);

          return (
            <div key={section.id} id={`preview-section-${section.id}`} className="group relative">
              
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-[#1a1a2e] tracking-tight">
                      {section.title}
                    </h3>
                    {section.id.toLowerCase().includes('sponsored') && (
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[8px] font-black uppercase tracking-wider border border-orange-200">
                        Sponsored
                      </span>
                    )}
                  </div>
                  {section.subtitle && (
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {section.subtitle}
                    </p>
                  )}
                </div>
                
                {items.length > 0 && (
                  <button className="flex items-center gap-1 text-xs font-extrabold text-[#EF3C23] hover:underline shrink-0 group-hover:translate-x-0.5 transition-all">
                    View All
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Empty state handler */}
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center text-app-text-secondary">
                  <Info className="w-6 h-6 text-app-text-secondary mb-2" />
                  <p className="text-xs font-bold text-slate-600">No items featured yet.</p>
                  <p className="text-[11px] text-app-text-secondary mt-1">Add items from the catalog injector panel on the left.</p>
                </div>
              ) : (
                /* Dynamic Custom Layouts per item types */
                <div>
                  {/* FEATURED DEALS: Render in grid (4 columns) */}
                  {section.id === 'featuredDeals' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col h-full hover:shadow-md transition-all group">
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black tracking-wider shadow">
                              {item.discount}
                            </div>
                          </div>
                          <div className="mt-3.5 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-950 line-clamp-1 leading-snug">{item.name}</h4>
                              <p className="text-xs text-slate-500 mt-1 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {item.seller}
                              </p>
                            </div>
                            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                              <span className="text-[10px] text-slate-500 font-bold">⏳ {item.expiry}</span>
                              <span className="text-[10px] text-[#EF3C23] font-black hover:underline cursor-pointer">Claim →</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SPOTLIGHT BRANDS or RECOMMENDED BRANDS: Grid of brand cards (6 columns) */}
                  {(section.id === 'spotlightBrands' || section.id === 'choosifyRecommendedBrands' || section.id === 'sponsoredBrands') && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all relative">
                          {section.id === 'sponsoredBrands' && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[7px] font-black uppercase tracking-wider border border-orange-100">
                              Ad
                            </span>
                          )}
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shrink-0 p-1">
                            <img src={item.logo} alt={item.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-center gap-1">
                              <h4 className="text-xs font-black text-slate-900 line-clamp-1 leading-none">{item.name}</h4>
                              {item.verified && <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 fill-sky-500/10 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 truncate">{item.category}</p>
                          </div>
                          {section.id === 'choosifyRecommendedBrands' && (
                            <span className="mt-2 text-[8px] font-extrabold text-[#EF3C23] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SPONSORED ADS: Horizontal banner carousel/slider */}
                  {section.id === 'sponsoredAds' && (
                    <div className="relative rounded-3xl overflow-hidden bg-app-bg border border-app-border aspect-[2.6/1] md:aspect-[3.5/1]">
                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={adIndex}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="absolute inset-0"
                        >
                          <img 
                            src={items[adIndex]?.image || FALLBACK_ADS[0].image} 
                            alt={items[adIndex]?.title || 'Campaign Banner'} 
                            className="w-full h-full object-cover opacity-60" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent p-6 md:p-10 flex flex-col justify-center">
                            <span className="text-[9px] md:text-xs font-black text-[#EF3C23] tracking-widest mb-1 block uppercase">
                              ✦ {items[adIndex]?.badge || 'CAMPAIGN LAUNCH'}
                            </span>
                            <h4 className="text-sm md:text-2xl font-black text-app-text-primary leading-tight max-w-lg">
                              {items[adIndex]?.title}
                            </h4>
                            <p className="text-[10px] md:text-xs text-app-text-secondary mt-1 font-semibold">
                              Sponsored partner: {items[adIndex]?.brand}
                            </p>
                            <div className="mt-4">
                              <button className="px-5 py-2 bg-[#EF3C23] hover:bg-orange-500 text-white font-extrabold text-[10px] md:text-xs rounded-xl shadow-lg transition-all">
                                Shop Collection ↗
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {/* Controls */}
                      {items.length > 1 && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-10">
                          <button 
                            onClick={() => setAdIndex(prev => (prev === 0 ? items.length - 1 : prev - 1))}
                            className="p-1.5 rounded-lg bg-app-bg/10 border border-app-border text-app-text-primary hover:bg-slate-800 transition-all"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[9px] font-mono font-bold text-app-text-secondary bg-app-bg/10 px-2 py-1 rounded-lg">
                            {adIndex + 1}/{items.length}
                          </span>
                          <button 
                            onClick={() => setAdIndex(prev => (prev === items.length - 1 ? 0 : prev + 1))}
                            className="p-1.5 rounded-lg bg-app-bg/10 border border-app-border text-app-text-primary hover:bg-slate-800 transition-all"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PRODUCTS: Sponsored & Recommended Products → Grid (5 columns) */}
                  {(section.id === 'sponsoredProducts' || section.id === 'recommendedProducts') && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-3 flex flex-col h-full hover:shadow-md transition-all relative group">
                          {section.id === 'sponsoredProducts' && (
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[7px] font-black uppercase tracking-wider shadow z-10">
                              Sponsored
                            </span>
                          )}
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" referrerPolicy="no-referrer" />
                            {item.badge && section.id === 'recommendedProducts' && (
                              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-app-card text-app-text-primary text-[7px] font-black uppercase tracking-wider shadow">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex-1 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] text-app-text-secondary font-bold block truncate">{item.brand}</span>
                              <h4 className="text-xs font-black text-slate-900 mt-0.5 line-clamp-2 leading-snug">{item.name}</h4>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2">
                              <span className="text-xs font-black text-[#EF3C23]">{item.price}</span>
                              {item.rating && (
                                <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                                  ★ {item.rating}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* RECOMMENDATIONS / GUIDES: Grid of guide/recommendation cards */}
                  {section.id === 'featuredRecommendations' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col h-full">
                          <div className="relative aspect-video w-full overflow-hidden bg-app-card shrink-0">
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover opacity-90" referrerPolicy="no-referrer" />
                            <span className="absolute top-2.5 left-2.5 bg-app-bg/10 text-app-text-primary border border-app-border px-2 py-0.5 rounded text-[8px] font-black tracking-wide">
                              {item.tag || 'GUIDE'}
                            </span>
                            {item.type === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-red-600/90 hover:scale-105 transition-transform flex items-center justify-center text-white shadow-lg">
                                  <Play className="w-4 h-4 fill-white ml-0.5" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <h4 className="text-sm font-black text-slate-950 line-clamp-2 leading-snug">{item.title}</h4>
                            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500">
                              <span className="font-semibold">By {item.creator}</span>
                              <span className="font-bold bg-slate-100 px-2 py-0.5 rounded">{item.reads || 'Read Now'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CREATORS: Featured & Recommended Creators */}
                  {(section.id === 'featuredCreators' || section.id === 'recommendedCreators') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {items.map((item: any) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3.5 hover:shadow-md transition-all relative">
                          <img 
                            src={item.avatar} 
                            alt={item.name} 
                            className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-100" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <h4 className="text-xs font-black text-slate-950 truncate leading-none">{item.name}</h4>
                              {item.verified && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/10 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 truncate">{item.category}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-[#EF3C23] font-black">{item.followers}</span>
                              {item.engagement && (
                                <span className="text-[9px] text-app-text-secondary font-semibold">ER: {item.engagement}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Branding Showcase */}
      <div className="border-t border-slate-200/80 pt-8 text-center text-xs text-app-text-secondary">
        <p className="font-black text-slate-700 tracking-wider">CHOOSIFY SPLIT-SCREEN VISUAL CMS</p>
        <p className="mt-1">Copyright © 2026 Choosify Bangladesh. Built with Antigravity Dev Studio v3.</p>
      </div>

    </div>
  );
}
