import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useBrandProfiles } from '../contexts/BrandProfilesContext';

export interface CMSAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionType: 'deals' | 'brands' | 'products' | 'creators' | 'guides' | 'ads';
  existingItemIds: string[];
  onAddItem: (itemId: string, sellerName?: string) => void;
}

// Complete Registries for fallback & matching selections
const PRODUCT_REGISTRY = [
  { id: 'p1', name: 'Samsung S25 Ultra', brand: 'Samsung Bangladesh', seller: 'TechZone BD', category: 'Mobile', price: '৳ 139,999' },
  { id: 'p2', name: 'Vision Smart TV 55"', brand: 'Vision', seller: 'ElectroBD', category: 'Electronics', price: '৳ 68,500' },
  { id: 'p3', name: 'Aarong Jamdani Saree', brand: 'Aarong', seller: 'Aarong Digital', category: 'Fashion', price: '৳ 4,200' },
  { id: 'p4', name: 'Walton 2-Door Fridge', brand: 'Walton', seller: 'ElectroBD', category: 'Home', price: '৳ 29,990' },
  { id: 'p5', name: 'Apex Men Royal Loafer', brand: 'Apex', seller: 'TechZone BD', category: 'Footwear', price: '৳ 4,500' },
  { id: 'p6', name: 'Urban Fit Elite Compression Tee', brand: 'Urban Fit', seller: 'Aarong Digital', category: 'Active Wear', price: '৳ 1,800' },
  { id: 'p7', name: 'TechCore Wireless Charging Pad', brand: 'TechCore', seller: 'TechZone BD', category: 'Consumer Tech', price: '৳ 1,200' },
  { id: 'p8', name: 'TechCore Bluetooth Watch V2', brand: 'TechCore', seller: 'ElectroBD', category: 'Consumer Tech', price: '৳ 3,800' },
];

const BRAND_REGISTRY = [
  { id: 'b1', name: 'Apex Footwear', category: 'Footwear & Apparel' },
  { id: 'b2', name: 'Walton Appliances', category: 'Electronics & Home' },
  { id: 'b3', name: 'Aarong Handcrafts', category: 'Fashion Heritage' },
  { id: 'b4', name: 'Samsung Bangladesh', category: 'Consumer Tech' },
  { id: 'b5', name: 'Sailor clothing', category: 'Apparel & Lifestyle' },
  { id: 'b6', name: 'Urban Fit active', category: 'Active Wear' },
];

const DEAL_REGISTRY = [
  { id: 'd1', name: 'Eid Mega Tech Voucher 2026', discount: '30% OFF', seller: 'TechZone BD' },
  { id: 'd2', name: 'Walton AC Summer Cooling Flash', discount: '40% OFF', seller: 'ElectroBD' },
  { id: 'd3', name: 'Aarong Jamdani Weekend Special', discount: '20% OFF', seller: 'Aarong Digital' },
];

const CREATOR_REGISTRY = [
  { id: 'c1', name: 'Rafsan The Chotobhai', followers: '1.2M', category: 'Food & Lifestyle' },
  { id: 'c2', name: 'Tawhid Afridi', followers: '2.5M', category: 'Vlogs & Tech' },
  { id: 'c3', name: 'Nadia Akter', followers: '450K', category: 'Fashion & Beauty' },
  { id: 'c4', name: 'SamZone tech', followers: '850K', category: 'Tech & Gadgets' },
];

const RECOMMENDATION_REGISTRY = [
  { id: 'rec1', title: 'Ultimate Panjabi Buying Guide for Eid 2026', creator: 'Rafsan The Chotobhai', tag: 'Eid Fashion' },
  { id: 'rec2', title: 'Top Budget-Friendly Refrigerator Matches in BD', creator: 'SamZone tech', tag: 'Home Tech' },
  { id: 'rec3', title: 'Premium Leather Shoes For High-Profile Formal Wear', creator: 'Tawhid Afridi', tag: 'Footwear' },
];

const AD_REGISTRY = [
  { id: 'promo_banner_01', title: 'Walton Smart Cooling AC Campaign', brand: 'Walton Bangladesh' },
  { id: 'promo_deal_01', title: 'Apex Eid Loafer Premium Launch Showcase', brand: 'Apex Footwear' },
];

export default function CMSAddItemModal({ 
  isOpen, 
  onClose, 
  sectionType, 
  existingItemIds, 
  onAddItem 
}: CMSAddItemModalProps) {
  
  const { profiles: brandProfiles } = useBrandProfiles();

  // Selected State
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Extract unique sellers from products and deals
  const uniqueSellers = useMemo(() => {
    const sellersSet = new Set<string>();
    
    if (sectionType === 'products') {
      PRODUCT_REGISTRY.forEach(p => {
        if (p.seller) sellersSet.add(p.seller);
      });
    } else if (sectionType === 'deals') {
      DEAL_REGISTRY.forEach(d => {
        if (d.seller) sellersSet.add(d.seller);
      });
    }
    
    return Array.from(sellersSet);
  }, [sectionType]);

  // Fetch candidate items based on section type and selected seller
  const candidates = useMemo(() => {
    if (sectionType === 'products') {
      let list = PRODUCT_REGISTRY;
      if (selectedSeller !== 'all') {
        list = list.filter(p => p.seller === selectedSeller);
      }
      return list.map(p => ({
        id: p.id,
        label: p.name,
        sublabel: `${p.brand} • ${p.price}`,
        seller: p.seller
      }));
    }

    if (sectionType === 'brands') {
      // Merge registered fallback with any real-time brands from BrandProfilesContext
      const mergedMap = new Map<string, { id: string; label: string; sublabel: string }>();
      
      BRAND_REGISTRY.forEach(b => {
        mergedMap.set(b.id, {
          id: b.id,
          label: b.name,
          sublabel: b.category
        });
      });

      if (brandProfiles && brandProfiles.length > 0) {
        brandProfiles.forEach(p => {
          mergedMap.set(p.id, {
            id: p.id,
            label: p.name,
            sublabel: p.category || p.industry || 'Local Brand'
          });
        });
      }

      return Array.from(mergedMap.values());
    }

    if (sectionType === 'deals') {
      let list = DEAL_REGISTRY;
      if (selectedSeller !== 'all') {
        list = list.filter(d => d.seller === selectedSeller);
      }
      return list.map(d => ({
        id: d.id,
        label: d.name,
        sublabel: `${d.discount} • ${d.seller}`,
        seller: d.seller
      }));
    }

    if (sectionType === 'creators') {
      return CREATOR_REGISTRY.map(c => ({
        id: c.id,
        label: c.name,
        sublabel: `${c.followers} Followers • ${c.category}`
      }));
    }

    if (sectionType === 'guides') {
      return RECOMMENDATION_REGISTRY.map(g => ({
        id: g.id,
        label: g.title,
        sublabel: `By ${g.creator} • ${g.tag}`
      }));
    }

    if (sectionType === 'ads') {
      return AD_REGISTRY.map(a => ({
        id: a.id,
        label: a.title,
        sublabel: `Campaign for ${a.brand}`
      }));
    }

    return [];
  }, [sectionType, selectedSeller, brandProfiles]);

  // Apply search query filter to candidates list
  const filteredCandidates = useMemo(() => {
    if (!searchQuery) return candidates;
    return candidates.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.sublabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [candidates, searchQuery]);

  // Handle select item & trigger duplication checks
  const handleSelectItem = (itemId: string) => {
    if (existingItemIds.includes(itemId)) {
      setErrorMessage('⚠️ This item is already added to this homepage section!');
      setSelectedItemId('');
    } else {
      setErrorMessage('');
      setSelectedItemId(itemId);
    }
  };

  // Submit back to CMS page
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;

    if (existingItemIds.includes(selectedItemId)) {
      setErrorMessage('⚠️ Duplicate item detected. Selection is blocked.');
      return;
    }

    // Call onAddItem callback with selected ID & optional seller info
    const selectedItem = candidates.find(c => c.id === selectedItemId);
    onAddItem(selectedItemId, selectedItem?.seller);
    
    // Reset state & close
    setSelectedItemId('');
    setSelectedSeller('all');
    setSearchQuery('');
    setErrorMessage('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-[480px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
          >
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                    CMS Catalog Injector
                  </span>
                </div>
                <h3 className="text-sm font-extrabold capitalize">
                  Add Item to {sectionType} Section
                </h3>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              {/* STEP 1: Seller Filter Dropdown (Show only for products & deals) */}
              {(sectionType === 'products' || sectionType === 'deals') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                    Step 1: Filter By Seller Partner
                  </label>
                  <select
                    value={selectedSeller}
                    onChange={(e) => {
                      setSelectedSeller(e.target.value);
                      setSelectedItemId(''); // reset item select
                      setErrorMessage('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-orange-500 transition-all cursor-pointer"
                  >
                    <option value="all">All Registered Sellers (All Channels)</option>
                    {uniqueSellers.map(seller => (
                      <option key={seller} value={seller}>{seller}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* STEP 2: Item Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                  Step 2: Select Listing Item ({filteredCandidates.length})
                </label>
                
                {/* Search Bar inside items */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${sectionType} names, IDs, tags...`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:bg-white focus:border-orange-500 transition-all"
                  />
                </div>

                {/* Candidate Items Scroll Container */}
                <div className="border border-slate-100 rounded-xl max-h-[180px] overflow-y-auto divide-y divide-slate-50">
                  {filteredCandidates.map(item => {
                    const isSelected = selectedItemId === item.id;
                    const isAlreadyAdded = existingItemIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isAlreadyAdded) return;
                          handleSelectItem(item.id);
                        }}
                        className={`flex items-center justify-between p-3 cursor-pointer text-left transition-all ${
                          isAlreadyAdded 
                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' 
                            : isSelected 
                              ? 'bg-orange-500/5 text-orange-950 font-bold' 
                              : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <h5 className="text-xs font-bold truncate">
                            {item.label}
                          </h5>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            ID: {item.id} • {item.sublabel}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isAlreadyAdded ? (
                            <span className="text-[8px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase font-black tracking-widest">
                              Featured
                            </span>
                          ) : isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center text-white">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredCandidates.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No matching {sectionType} candidates found.
                    </div>
                  )}
                </div>
              </div>

              {/* Error Notification Block */}
              {errorMessage && (
                <div className="flex items-start gap-2 p-3.5 bg-red-50 rounded-xl border border-red-100 text-red-700 text-xs font-semibold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedItemId || !!errorMessage}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  Add to Section
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
