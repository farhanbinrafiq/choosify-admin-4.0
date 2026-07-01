import React, { useState, useMemo } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  TrendingUp, 
  Tag, 
  Tv, 
  Shirt, 
  Box, 
  Smartphone, 
  Search, 
  Award, 
  Star, 
  CheckCircle2, 
  Info, 
  RotateCcw,
  LayoutGrid,
  Sliders,
  Play,
  Heart,
  ChevronRight,
  Share2,
  Bookmark,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCMSData, CMSData, CMSSection } from '../../contexts/CMSDataContext';
import CMSAddItemModal from '../../components/CMSAddItemModal';
import CMSLivePreview from '../../components/CMSLivePreview';

// Define real-world Bangladeshi platform mock data elements
interface ProductItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  rating: number;
  image: string;
  badge?: string;
}

interface BrandItem {
  id: string;
  name: string;
  logo: string;
  category: string;
  rating: number;
  verified: boolean;
}

interface DealItem {
  id: string;
  name: string;
  discount: string;
  seller: string;
  image: string;
  expiry: string;
}

interface CreatorItem {
  id: string;
  name: string;
  avatar: string;
  followers: string;
  category: string;
  engagement: string;
}

interface RecommendationItem {
  id: string;
  title: string;
  creator: string;
  image: string;
  reads: string;
  tag: string;
}

interface AdItem {
  id: string;
  title: string;
  image: string;
  link: string;
  brand: string;
  badge?: string;
}

// Data Registries matching Bangladeshi contexts
const PRODUCT_REGISTRY: Record<string, ProductItem> = {
  'p1': { id: 'p1', name: 'Samsung S25 Ultra', brand: 'Samsung Bangladesh', category: 'Mobile', price: '৳ 139,999', rating: 4.9, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', badge: 'Hot Seller' },
  'p2': { id: 'p2', name: 'Vision Smart TV 55"', brand: 'Vision', category: 'Electronics', price: '৳ 68,500', rating: 4.7, image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&q=80', badge: 'Popular' },
  'p3': { id: 'p3', name: 'Aarong Jamdani Saree', brand: 'Aarong', category: 'Fashion', price: '৳ 4,200', rating: 4.8, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80', badge: 'Authentic' },
  'p4': { id: 'p4', name: 'Walton 2-Door Fridge', brand: 'Walton', category: 'Home', price: '৳ 29,990', rating: 4.5, image: 'https://images.unsplash.com/photo-1571175432247-50a2e4c6bb77?w=400&q=80' },
  'p5': { id: 'p5', name: 'Apex Men Royal Loafer', brand: 'Apex', category: 'Footwear', price: '৳ 4,500', rating: 4.6, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80', badge: 'Premium' },
  'p6': { id: 'p6', name: 'Urban Fit Elite Compression Tee', brand: 'Urban Fit', category: 'Active Wear', price: '৳ 1,800', rating: 4.7, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&q=80' },
  'p7': { id: 'p7', name: 'TechCore Wireless Charging Pad', brand: 'TechCore', category: 'Consumer Tech', price: '৳ 1,200', rating: 4.4, image: 'https://images.unsplash.com/photo-1622445262465-2481c4574875?w=400&q=80' },
  'p8': { id: 'p8', name: 'TechCore Bluetooth Watch V2', brand: 'TechCore', category: 'Consumer Tech', price: '৳ 3,800', rating: 4.5, image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&q=80' },
};

const BRAND_REGISTRY: Record<string, BrandItem> = {
  'b1': { id: 'b1', name: 'Apex Footwear', logo: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=100&q=80', category: 'Footwear & Apparel', rating: 4.8, verified: true },
  'b2': { id: 'b2', name: 'Walton Appliances', logo: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=100&q=80', category: 'Electronics & Home', rating: 4.5, verified: true },
  'b3': { id: 'b3', name: 'Aarong Handcrafts', logo: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=100&q=80', category: 'Fashion Heritage', rating: 4.9, verified: true },
  'b4': { id: 'b4', name: 'Samsung Bangladesh', logo: 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=100&q=80', category: 'Consumer Tech', rating: 4.9, verified: true },
  'b5': { id: 'b5', name: 'Sailor clothing', logo: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=100&q=80', category: 'Apparel & Lifestyle', rating: 4.7, verified: true },
  'b6': { id: 'b6', name: 'Urban Fit active', logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=100&q=80', category: 'Active Wear', rating: 4.6, verified: true },
};

const DEAL_REGISTRY: Record<string, DealItem> = {
  'd1': { id: 'd1', name: 'Eid Mega Tech Voucher 2026', discount: '30% OFF', seller: 'TechZone BD', image: 'https://images.unsplash.com/photo-1468436139062-f60a71c5c892?w=400&q=80', expiry: '12 days left' },
  'd2': { id: 'd2', name: 'Walton AC Summer Cooling Flash', discount: '40% OFF', seller: 'ElectroBD', image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&q=80', expiry: '18 hours left' },
  'd3': { id: 'd3', name: 'Aarong Jamdani Weekend Special', discount: '20% OFF', seller: 'Aarong Digital', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80', expiry: '2 days left' },
};

const CREATOR_REGISTRY: Record<string, CreatorItem> = {
  'c1': { id: 'c1', name: 'Rafsan The Chotobhai', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80', followers: '1.2M', category: 'Food & Lifestyle', engagement: '8.4%' },
  'c2': { id: 'c2', name: 'Tawhid Afridi', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80', followers: '2.5M', category: 'Vlogs & Tech', engagement: '11.2%' },
  'c3': { id: 'c3', name: 'Nadia Akter', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80', followers: '450K', category: 'Fashion & Beauty', engagement: '6.7%' },
  'c4': { id: 'c4', name: 'SamZone tech', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80', followers: '850K', category: 'Tech & Gadgets', engagement: '9.1%' },
};

const RECOMMENDATION_REGISTRY: Record<string, RecommendationItem> = {
  'rec1': { id: 'rec1', title: 'Ultimate Panjabi Buying Guide for Eid 2026', creator: 'Rafsan The Chotobhai', reads: '12.4K reads', image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400&q=80', tag: 'Eid Fashion' },
  'rec2': { id: 'rec2', title: 'Top Budget-Friendly Refrigerator Matches in BD', creator: 'SamZone tech', reads: '8.1K reads', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80', tag: 'Home Tech' },
  'rec3': { id: 'rec3', title: 'Premium Leather Shoes For High-Profile Formal Wear', creator: 'Tawhid Afridi', reads: '5.9K reads', image: 'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=400&q=80', tag: 'Footwear' },
};

const AD_REGISTRY: Record<string, AdItem> = {
  'promo_banner_01': { id: 'promo_banner_01', title: 'Walton Smart Cooling AC Campaign', brand: 'Walton Bangladesh', link: '/brand/walton', image: 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&q=80', badge: 'SUMMER COOLING' },
  'promo_deal_01': { id: 'promo_deal_01', title: 'Apex Eid Loafer Premium Launch Showcase', brand: 'Apex Footwear', link: '/brand/apex', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', badge: 'EID EXCLUSIVE' },
};

export default function CMSPage() {
  const { 
    cmsData, 
    updateSection, 
    toggleSectionActive, 
    reorderSection, 
    clearSection, 
    updateSectionMeta, 
    resetToDefault 
  } = useCMSData();

  const [selectedSectionId, setSelectedSectionId] = useState<keyof CMSData>('featuredDeals');
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  // Convert registries to flat arrays for CMSLivePreview
  const productsArray = useMemo(() => Object.values(PRODUCT_REGISTRY), []);
  const brandsArray = useMemo(() => Object.values(BRAND_REGISTRY), []);
  const creatorsArray = useMemo(() => Object.values(CREATOR_REGISTRY).map(c => ({ ...c, verified: true })), []);
  const dealsArray = useMemo(() => Object.values(DEAL_REGISTRY), []);
  const guidesArray = useMemo(() => Object.values(RECOMMENDATION_REGISTRY), []);

  // Map active section to its content type for the modal
  const mappedSectionType = useMemo(() => {
    const id = selectedSectionId as string;
    if (id.toLowerCase().includes('deal')) return 'deals';
    if (id.toLowerCase().includes('brand')) return 'brands';
    if (id.toLowerCase().includes('creator')) return 'creators';
    if (id.toLowerCase().includes('product')) return 'products';
    if (id.toLowerCase().includes('recommendation')) return 'guides';
    if (id.toLowerCase().includes('ad')) return 'ads';
    return 'products';
  }, [selectedSectionId]);

  // Trigger toast helper
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = () => {
    setIsSaving(true);
    // Explicit trigger of saving to localstorage
    try {
      localStorage.setItem('choosify_cms_data', JSON.stringify(cmsData));
      setTimeout(() => {
        setIsSaving(false);
        showToast('CMS changes compiled & persistent locally! 🎉');
      }, 800);
    } catch (e) {
      setIsSaving(false);
      showToast('Error syncing content state!');
    }
  };

  // Safe fetch for active section
  const activeSection = useMemo(() => {
    return cmsData[selectedSectionId] || {
      id: selectedSectionId,
      title: 'Section',
      itemIds: [],
      isActive: true,
      order: 1,
      layout: 'grid'
    };
  }, [cmsData, selectedSectionId]);

  // Determine which registry matches the selected section
  const sectionRegistryType = useMemo(() => {
    const id = selectedSectionId as string;
    if (id.toLowerCase().includes('product')) return 'product';
    if (id.toLowerCase().includes('brand')) return 'brand';
    if (id.toLowerCase().includes('creator')) return 'creator';
    if (id.toLowerCase().includes('deal')) return 'deal';
    if (id.toLowerCase().includes('recommendation')) return 'recommendation';
    if (id.toLowerCase().includes('ad')) return 'ad';
    return 'product';
  }, [selectedSectionId]);

  // Get available items that are not already in the section
  const availableItemsToAdd = useMemo(() => {
    const currentIds = activeSection.itemIds || [];
    if (sectionRegistryType === 'product') {
      return Object.values(PRODUCT_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    if (sectionRegistryType === 'brand') {
      return Object.values(BRAND_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    if (sectionRegistryType === 'creator') {
      return Object.values(CREATOR_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    if (sectionRegistryType === 'deal') {
      return Object.values(DEAL_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    if (sectionRegistryType === 'recommendation') {
      return Object.values(RECOMMENDATION_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    if (sectionRegistryType === 'ad') {
      return Object.values(AD_REGISTRY).filter(item => !currentIds.includes(item.id));
    }
    return [];
  }, [sectionRegistryType, activeSection.itemIds]);

  // Filter available items based on search query
  const filteredAvailableItems = useMemo(() => {
    if (!searchQuery) return availableItemsToAdd;
    return availableItemsToAdd.filter((item: any) => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableItemsToAdd, searchQuery]);

  // Handler to add item to section
  const handleAddItem = (itemId: string) => {
    const currentIds = [...activeSection.itemIds, itemId];
    updateSection(selectedSectionId, currentIds);
    setSearchQuery('');
    showToast(`Added to "${activeSection.title}"`);
  };

  // Handler to remove item from section
  const handleRemoveItem = (itemId: string) => {
    const currentIds = activeSection.itemIds.filter(id => id !== itemId);
    updateSection(selectedSectionId, currentIds);
    showToast(`Removed from "${activeSection.title}"`);
  };

  // Handler to shift item sorting order inside section
  const handleMoveItemOrder = (index: number, direction: 'up' | 'down') => {
    const currentIds = [...activeSection.itemIds];
    if (direction === 'up' && index > 0) {
      const temp = currentIds[index];
      currentIds[index] = currentIds[index - 1];
      currentIds[index - 1] = temp;
    } else if (direction === 'down' && index < currentIds.length - 1) {
      const temp = currentIds[index];
      currentIds[index] = currentIds[index + 1];
      currentIds[index + 1] = temp;
    }
    updateSection(selectedSectionId, currentIds);
  };

  // Shift section order vertically in homepage preview
  const handleMoveSectionOrder = (sectionId: keyof CMSData, direction: 'up' | 'down') => {
    const sorted = sortedSectionsList;
    const index = sorted.findIndex(s => s.id === sectionId);
    if (direction === 'up' && index > 0) {
      const prevSection = sorted[index - 1];
      const prevOrder = prevSection.order;
      const currOrder = sorted[index].order;
      reorderSection(sectionId, prevOrder);
      reorderSection(prevSection.id, currOrder);
      showToast(`Moved "${sorted[index].title}" up`);
    } else if (direction === 'down' && index < sorted.length - 1) {
      const nextSection = sorted[index + 1];
      const nextOrder = nextSection.order;
      const currOrder = sorted[index].order;
      reorderSection(sectionId, nextOrder);
      reorderSection(nextSection.id, currOrder);
      showToast(`Moved "${sorted[index].title}" down`);
    }
  };

  // Sorting helper for active layout
  const sortedSectionsList = useMemo(() => {
    return Object.values(cmsData)
      .filter((s): s is CMSSection => !!s && typeof s === 'object' && 'id' in s)
      .sort((a, b) => a.order - b.order);
  }, [cmsData]);

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary px-5 py-3.5 rounded-xl shadow-2xl border border-app-border"
          >
            <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
            <span className="text-xs font-semibold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-app-card border border-app-border p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest">PRO STUDIO v3</span>
            <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Homepage Visual CMS</h1>
          </div>
          <p className="text-[12px] text-app-text-secondary">
            Design the live split-screen content experience. Reorder widgets, inject ads, curate recommended creators, and deploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              resetToDefault();
              showToast('CMS restored to seed preloads! 🌀');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-app-bg border border-app-border rounded-xl text-app-text-secondary hover:text-white hover:bg-slate-700/80 transition-all text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-app-border border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Compile & Save
          </button>
        </div>
      </div>

      {/* Grid Layout: Left is Editor (50%), Right is live interactive Preview (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* ==============================================
            LEFT PANEL: EDITOR COLUMN
            ============================================== */}
        <div className="space-y-6">
          
          {/* SECTION MANAGER SELECTOR CARD */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Select Homepage Section
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                10 Configurable Modules
              </span>
            </div>

            {/* List of sections with inline action toggles */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 select-none">
              {sortedSectionsList.map((sec, idx) => {
                const isSelected = selectedSectionId === sec.id;
                return (
                  <div 
                    key={sec.id}
                    className={`group flex items-center justify-between p-3 rounded-2xl border transition-all${
                      isSelected 
                        ? 'bg-orange-500/5 border-orange-500 shadow-sm' 
                        : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/50 hover:border-slate-200'
                    }`}
                  >
                    <div 
                      onClick={() => setSelectedSectionId(sec.id as keyof CMSData)}
                      className="flex-1 min-w-0 cursor-pointer flex items-center gap-3"
                    >
                      <div className="flex flex-col shrink-0 items-center justify-center w-6 h-6 rounded-lg bg-slate-200/50 text-slate-500 text-[10px] font-bold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs font-bold truncate${isSelected ? 'text-orange-600' : 'text-slate-900'}`}>
                            {sec.title}
                          </h4>
                          {!sec.isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 text-[8px] font-black uppercase">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5 capitalize">
                          Type: {sec.id.replace('featured', '').replace('sponsored', '').replace('recommended', '').replace('choosify', '') || 'Generic'} • {sec.itemIds.length} items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Move Order arrows */}
                      <button
                        onClick={() => handleMoveSectionOrder(sec.id as keyof CMSData, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-app-text-secondary hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded transition-all"
                        title="Move Section Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveSectionOrder(sec.id as keyof CMSData, 'down')}
                        disabled={idx === sortedSectionsList.length - 1}
                        className="p-1 text-app-text-secondary hover:text-slate-800 disabled:opacity-20 hover:bg-slate-100 rounded transition-all"
                        title="Move Section Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Active Status Toggle */}
                      <button 
                        onClick={() => {
                          toggleSectionActive(sec.id, !sec.isActive);
                          showToast(`${sec.title} is now ${!sec.isActive ? 'Visible' : 'Hidden'}`);
                        }}
                        className={`ml-1 p-1.5 rounded-lg transition-all${
                          sec.isActive 
                            ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                            : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                        }`}
                        title={sec.isActive ? "Hide on Homepage" : "Show on Homepage"}
                      >
                        {sec.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE SECTION METADATA & ITEM EDIT CARDS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                  Active Editor View
                </span>
                <span className="text-[10px] text-app-text-secondary font-mono">
                  Order: #{activeSection.order}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {activeSection.title}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Customize content rules, header labels, layout types, and curations for this specific widget block.
              </p>
            </div>

            {/* METADATA FORM FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                  Widget Display Title
                </label>
                <input 
                  type="text" 
                  value={activeSection.title}
                  onChange={(e) => updateSectionMeta(selectedSectionId, { title: e.target.value })}
                  placeholder="Enter custom title..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-950 font-medium focus:bg-white focus:border-orange-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                  Subtitle Description
                </label>
                <input 
                  type="text" 
                  value={activeSection.subtitle || ''}
                  onChange={(e) => updateSectionMeta(selectedSectionId, { subtitle: e.target.value })}
                  placeholder="Enter microcopy tagline..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-950 font-medium focus:bg-white focus:border-orange-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                  Layout Architecture
                </label>
                <select 
                  value={activeSection.layout || 'grid'}
                  onChange={(e) => updateSectionMeta(selectedSectionId, { layout: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-950 font-semibold focus:bg-white focus:border-orange-500 outline-none transition-all"
                >
                  <option value="grid">Grid (Bento Grid)</option>
                  <option value="carousel">Carousel (Swipe-left)</option>
                  <option value="slider">Slider (Full-Width Banner)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                  Status State
                </label>
                <button 
                  onClick={() => toggleSectionActive(selectedSectionId, !activeSection.isActive)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all${
                    activeSection.isActive 
                      ? 'bg-green-500/5 border-green-200 text-green-700 hover:bg-green-100/50' 
                      : 'bg-red-500/5 border-red-200 text-red-600 hover:bg-red-100/50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full${activeSection.isActive ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                  {activeSection.isActive ? 'Active on Homepage' : 'Hidden from View'}
                </button>
              </div>
            </div>

            {/* CURATED ITEMS IN THE ACTIVE SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Curated Content ({activeSection.itemIds.length})
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      clearSection(selectedSectionId);
                      showToast(`Cleared items for "${activeSection.title}"`);
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-500 font-bold transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* CURATED CONTENT CARD CAROUSEL/LIST */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {activeSection.itemIds.map((itemId, idx) => {
                  let name = 'Unknown Item';
                  let detail = 'ID: ' + itemId;
                  let img = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100&q=80';

                  if (sectionRegistryType === 'product' && PRODUCT_REGISTRY[itemId]) {
                    const item = PRODUCT_REGISTRY[itemId];
                    name = item.name;
                    detail = `${item.brand} • ${item.price}`;
                    img = item.image;
                  } else if (sectionRegistryType === 'brand' && BRAND_REGISTRY[itemId]) {
                    const item = BRAND_REGISTRY[itemId];
                    name = item.name;
                    detail = `${item.category} • ★ ${item.rating}`;
                    img = item.logo;
                  } else if (sectionRegistryType === 'creator' && CREATOR_REGISTRY[itemId]) {
                    const item = CREATOR_REGISTRY[itemId];
                    name = item.name;
                    detail = `${item.followers} Followers • ${item.category}`;
                    img = item.avatar;
                  } else if (sectionRegistryType === 'deal' && DEAL_REGISTRY[itemId]) {
                    const item = DEAL_REGISTRY[itemId];
                    name = item.name;
                    detail = `${item.discount} Voucher • ${item.seller}`;
                    img = item.image;
                  } else if (sectionRegistryType === 'recommendation' && RECOMMENDATION_REGISTRY[itemId]) {
                    const item = RECOMMENDATION_REGISTRY[itemId];
                    name = item.title;
                    detail = `Guide • By ${item.creator}`;
                    img = item.image;
                  } else if (sectionRegistryType === 'ad' && AD_REGISTRY[itemId]) {
                    const item = AD_REGISTRY[itemId];
                    name = item.title;
                    detail = `Ad Promo Banner • ${item.brand}`;
                    img = item.image;
                  }

                  return (
                    <div 
                      key={itemId}
                      className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 transition-all group"
                    >
                      <img 
                        src={img} 
                        alt={name} 
                        className="w-10 h-10 rounded-lg object-cover bg-white shrink-0 border border-slate-100" 
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{name}</h4>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{detail}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveItemOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-app-text-secondary hover:text-slate-800 disabled:opacity-20 transition-all"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveItemOrder(idx, 'down')}
                          disabled={idx === activeSection.itemIds.length - 1}
                          className="p-1 text-app-text-secondary hover:text-slate-800 disabled:opacity-20 transition-all"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleRemoveItem(itemId)}
                          className="p-1.5 text-app-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove from Section"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {activeSection.itemIds.length === 0 && (
                  <div className="p-8 text-center border-2 border-dashed border-slate-100 bg-slate-50/50 rounded-2xl text-app-text-secondary text-xs italic">
                    No items selected. Click [+ Add Item] below to populate.
                  </div>
                )}
              </div>

              {/* SEARCH & ADD MODAL PORTAL */}
              <div className="relative">
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-app-card hover:bg-slate-800 text-app-text-primary text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 animate-pulse-subtle hover:scale-[1.01]"
                >
                  <Plus className="w-4 h-4 text-orange-500 animate-bounce" />
                  Add Content Item
                </button>

                <CMSAddItemModal
                  isOpen={isAddModalOpen}
                  onClose={() => setIsAddModalOpen(false)}
                  sectionType={mappedSectionType}
                  existingItemIds={activeSection.itemIds}
                  onAddItem={(itemId) => handleAddItem(itemId)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==============================================
            RIGHT PANEL: LIVE INTERACTIVE PREVIEW
            ============================================== */}
        <div className="sticky top-6">
          <div className="bg-app-card border border-app-border rounded-3xl p-6 shadow-2xl space-y-4">
            
            {/* Viewport Control Head */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <h3 className="text-xs font-black text-app-text-primary uppercase tracking-widest">
                  Live Preview Stream
                </h3>
              </div>
              
              <div className="flex bg-app-bg border border-app-border rounded-xl p-0.5 text-[10px] font-black">
                <button 
                  onClick={() => setPreviewMode('mobile')}
                  className={`px-3 py-1.5 rounded-lg transition-all${
                    previewMode === 'mobile' 
                      ? 'bg-orange-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mobile View
                </button>
                <button 
                  onClick={() => setPreviewMode('desktop')}
                  className={`px-3 py-1.5 rounded-lg transition-all${
                    previewMode === 'desktop' 
                      ? 'bg-orange-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Desktop Web
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER WRAPPER */}
            <div className={`mx-auto bg-app-bg border-4 border-app-border rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300${
              previewMode === 'mobile' ? 'max-w-[375px]' : 'w-full'
            }`}>
              
              {/* Smartphone Top Notch Notch Screen Bar */}
              <div className="bg-app-card text-[10px] font-mono text-app-text-secondary px-6 py-2.5 flex justify-between items-center border-b border-app-border select-none">
                <span className="font-bold text-app-text-primary">Choosify Live</span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <span className="text-[8px] bg-app-bg text-app-text-secondary px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                    UTC 07:00
                  </span>
                </div>
              </div>

              {/* LIVE HOMEPAGE SCROLLABLE REGION - rendered using CMSLivePreview */}
              <div className="bg-app-bg overflow-y-auto max-h-[550px] custom-scrollbar">
                <CMSLivePreview
                  cmsData={cmsData}
                  products={productsArray}
                  brands={brandsArray}
                  creators={creatorsArray}
                  deals={dealsArray}
                  guides={guidesArray}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


