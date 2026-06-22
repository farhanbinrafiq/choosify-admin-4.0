import React, { useState, useMemo, useEffect } from 'react';
import { 
  Tag, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Pause, 
  Check, 
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Deal Interface Definitions requested
export interface Deal {
  id: string;
  name: string;
  seller: string;
  discount: number; // must be a number, not string
  category: string;
  expiry: string; // ISO date string
  clicks: number;
  status: 'Live' | 'Pending' | 'Expiring' | 'Expired' | 'Rejected';
  type: 'retail' | 'wholesale';
  linkedProductId?: string;
  promoCode?: string;
}

export interface PromoCode {
  id: string;
  code: string; // uppercase
  brandId: string;
  brandName: string;
  discount: string; // "Flat 12% OFF", etc.
  type: 'percentage' | 'flat';
  value: number;
  minOrderValue?: number;
  maxUsage?: number;
  usedCount: number; // starts at 0
  validUntil: string; // ISO date
  active: boolean;
}

export default function DealsPage() {
  const [activeTab, setActiveTab] = useState<'deals' | 'promo_codes'>('deals');

  // Initialize state with same 3 deals as seed data mapped to the required Deal interface
  const [deals, setDeals] = useState<Deal[]>([
    {
      id: '1',
      name: 'Eid Mega Tech Sale 2026',
      seller: 'TechZone BD',
      discount: 30,
      category: 'Electronics',
      expiry: '2026-06-30T23:59:59.000Z',
      clicks: 8420,
      status: 'Pending',
      type: 'retail'
    },
    {
      id: '2',
      name: 'Walton AC Summer Flash',
      seller: 'ElectroBD',
      discount: 40,
      category: 'Home',
      expiry: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), // 18 hours left
      clicks: 12100,
      status: 'Live',
      type: 'retail'
    },
    {
      id: '3',
      name: 'Aarong Jamdani Weekend',
      seller: 'Aarong Digital',
      discount: 20,
      category: 'Fashion',
      expiry: '2026-07-05T23:59:59.000Z',
      clicks: 4240,
      status: 'Live',
      type: 'retail'
    }
  ]);

  // Seed with 5 promo codes for Bangladeshi brands matching SearchPage codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([
    {
      id: 'p_1',
      code: 'AARONG12',
      brandId: 'brand_aarong',
      brandName: 'Aarong',
      discount: '12% OFF',
      type: 'percentage',
      value: 12,
      minOrderValue: 2000,
      maxUsage: 1000,
      usedCount: 140,
      validUntil: '2026-12-31T23:59:59.000Z',
      active: true
    },
    {
      id: 'p_2',
      code: 'APEXFLAT400',
      brandId: 'brand_apex',
      brandName: 'Apex',
      discount: 'Flat ৳400 OFF',
      type: 'flat',
      value: 400,
      minOrderValue: 2500,
      maxUsage: 500,
      usedCount: 98,
      validUntil: '2026-09-30T23:59:59.000Z',
      active: true
    },
    {
      id: 'p_3',
      code: 'SAILORSPRING',
      brandId: 'brand_sailor',
      brandName: 'Sailor',
      discount: '15% OFF',
      type: 'percentage',
      value: 15,
      minOrderValue: 1500,
      maxUsage: 350,
      usedCount: 52,
      validUntil: '2026-08-31T23:59:59.000Z',
      active: true
    },
    {
      id: 'p_4',
      code: 'ADIDAS500',
      brandId: 'brand_adidas',
      brandName: 'Adidas',
      discount: 'Flat ৳500 OFF',
      type: 'flat',
      value: 500,
      minOrderValue: 4000,
      maxUsage: 200,
      usedCount: 65,
      validUntil: '2026-11-30T23:59:59.000Z',
      active: true
    },
    {
      id: 'p_5',
      code: 'BAYFLASH',
      brandId: 'brand_bay_emporium',
      brandName: 'Bay Emporium',
      discount: 'Flat ৳300 OFF',
      type: 'flat',
      value: 300,
      minOrderValue: 1500,
      maxUsage: 150,
      usedCount: 150,
      validUntil: '2025-12-31T23:59:59.000Z', // Expired
      active: false
    }
  ]);

  // UI state managers
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Form slide-in state managers (Deals)
  const [isAdding, setIsAdding] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  // Form slide-in state managers (Promo Codes)
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);

  // Form input states (Deals)
  const [formName, setFormName] = useState('');
  const [formSeller, setFormSeller] = useState('');
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState('Electronics');
  const [formType, setFormType] = useState<'retail' | 'wholesale'>('retail');
  const [formExpiry, setFormExpiry] = useState('');
  const [formPromoCode, setFormPromoCode] = useState('');

  // Form input states (Promo Codes)
  const [promoFormCode, setPromoFormCode] = useState('');
  const [promoFormBrandName, setPromoFormBrandName] = useState('');
  const [promoFormType, setPromoFormType] = useState<'percentage' | 'flat'>('percentage');
  const [promoFormValue, setPromoFormValue] = useState<number>(0);
  const [promoFormMinOrder, setPromoFormMinOrder] = useState<number>(0);
  const [promoFormMaxUsage, setPromoFormMaxUsage] = useState<number>(0);
  const [promoFormValidUntil, setPromoFormValidUntil] = useState('');

  // Auto-fill form state when editing or adding (Deals)
  useEffect(() => {
    if (editingDeal) {
      setFormName(editingDeal.name);
      setFormSeller(editingDeal.seller);
      setFormDiscount(editingDeal.discount);
      setFormCategory(editingDeal.category);
      setFormType(editingDeal.type);
      
      const parsedDate = new Date(editingDeal.expiry);
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      setFormExpiry(`${yyyy}-${mm}-${dd}`);
      setFormPromoCode(editingDeal.promoCode || '');
      setIsAdding(false);
    } else if (isAdding) {
      setFormName('');
      setFormSeller('');
      setFormDiscount(0);
      setFormCategory('Electronics');
      setFormType('retail');
      
      // Default to 48 hours tomorrow YYYY-MM-DD
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      setFormExpiry(`${yyyy}-${mm}-${dd}`);
      setFormPromoCode('');
    }
  }, [editingDeal, isAdding]);

  // Auto-fill form state when editing or adding (Promo Codes)
  useEffect(() => {
    if (editingPromo) {
      setPromoFormCode(editingPromo.code);
      setPromoFormBrandName(editingPromo.brandName);
      setPromoFormType(editingPromo.type);
      setPromoFormValue(editingPromo.value);
      setPromoFormMinOrder(editingPromo.minOrderValue || 0);
      setPromoFormMaxUsage(editingPromo.maxUsage || 0);
      
      const parsedDate = new Date(editingPromo.validUntil);
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      setPromoFormValidUntil(`${yyyy}-${mm}-${dd}`);
      setIsAddingPromo(false);
    } else if (isAddingPromo) {
      setPromoFormCode('');
      setPromoFormBrandName('');
      setPromoFormType('percentage');
      setPromoFormValue(0);
      setPromoFormMinOrder(0);
      setPromoFormMaxUsage(0);
      
      // Default to 30 days starting from today
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const yyyy = future.getFullYear();
      const mm = String(future.getMonth() + 1).padStart(2, '0');
      const dd = String(future.getDate()).padStart(2, '0');
      setPromoFormValidUntil(`${yyyy}-${mm}-${dd}`);
    }
  }, [editingPromo, isAddingPromo]);

  // Dynamic helper for toast system
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Condition check: Expiring status automatically computed if deal expires within 48 hours
  const isExpiringWithin48h = (expiryStr: string, currentStatus: Deal['status']) => {
    if (currentStatus === 'Expired' || currentStatus === 'Rejected') return false;
    const expiry = new Date(expiryStr).getTime();
    const now = new Date().getTime();
    const diffHours = (expiry - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  };

  // Condition check: Expired status automatically computed if current date is past expiry
  const isExpiredDeal = (expiryStr: string) => {
    return new Date(expiryStr).getTime() < new Date().getTime();
  };

  // Get raw/computed status dynamically
  const getComputedStatus = (deal: Deal): Deal['status'] => {
    if (deal.status === 'Rejected') return 'Rejected';
    if (deal.status === 'Expired' || isExpiredDeal(deal.expiry)) return 'Expired';
    if (isExpiringWithin48h(deal.expiry, deal.status)) return 'Expiring';
    return deal.status;
  };

  // Expiry display string builder helper (dynamic or formatted)
  const getExpiryDisplay = (expiryStr: string) => {
    const expiry = new Date(expiryStr).getTime();
    const now = new Date().getTime();
    const diffMs = expiry - now;
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 48) {
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m left`;
      }
      return `${diffHours}h left`;
    }
    
    return new Date(expiryStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if promo code is expired
  const isPromoExpired = (promo: PromoCode) => {
    return new Date(promo.validUntil).getTime() < Date.now();
  };

  // Dynamically compute global catalog stats from the seed state (not cached list)
  const computedStats = useMemo(() => {
    const rawDeals = deals.map(d => ({
      ...d,
      computedStatus: getComputedStatus(d)
    }));

    return {
      total: rawDeals.length,
      live: rawDeals.filter(d => d.computedStatus === 'Live').length,
      pending: rawDeals.filter(d => d.computedStatus === 'Pending').length,
      expiring48h: rawDeals.filter(d => d.computedStatus === 'Expiring').length
    };
  }, [deals]);

  // Compute promo code statistics
  const promoStats = useMemo(() => {
    const total = promoCodes.length;
    const active = promoCodes.filter(p => p.active && !isPromoExpired(p)).length;
    const expired = promoCodes.filter(isPromoExpired).length;
    const totalUses = promoCodes.reduce((sum, p) => sum + p.usedCount, 0);
    return { total, active, expired, totalUses };
  }, [promoCodes]);

  // Extract all categories currently tracked inside our database catalog
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(deals.map(d => d.category)));
  }, [deals]);

  // Search filter and conditional filters using useMemo for high performance
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // 1. Controlled search matches name or seller
      const matchesSearch = 
        deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.seller.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Computed status filter match
      const currentComputedStatus = getComputedStatus(deal);
      const matchesStatus = 
        statusFilter === 'All' || 
        currentComputedStatus.toLowerCase() === statusFilter.toLowerCase();
      
      // 3. Category filter match
      const matchesCategory = 
        categoryFilter === 'All' || 
        deal.category.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [deals, searchTerm, statusFilter, categoryFilter]);

  // Promo code search filtering
  const filteredPromoCodes = useMemo(() => {
    return promoCodes.filter(promo => {
      const matchesSearch = 
        promo.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        promo.brandName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [promoCodes, searchTerm]);

  // Checkbox management state hooks
  const allFilteredSelected = useMemo(() => {
    if (filteredDeals.length === 0) return false;
    return filteredDeals.every(d => selectedIds.includes(d.id));
  }, [filteredDeals, selectedIds]);

  const handleSelectAllToggle = () => {
    if (allFilteredSelected) {
      const filteredIds = filteredDeals.map(d => d.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredDeals.map(d => d.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Actions handler implementations (Deals)
  const handleApprove = (id: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, status: 'Live' } : d));
    triggerToast("Deal successfully approved and made Live!");
  };

  const handleReject = (id: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, status: 'Rejected' as const } : d));
    triggerToast("Deal request rejected.");
  };

  const handlePause = (id: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, status: 'Expired' as const } : d));
    triggerToast("Deal paused (moved to expired state).");
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this deal?")) {
      setDeals(prev => prev.filter(d => d.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      triggerToast("Deal removed successfully.");
    }
  };

  // Bulk actions handlers
  const handleBulkApprove = () => {
    setDeals(prev => prev.map(d => 
      selectedIds.includes(d.id) && d.status === 'Pending' ? { ...d, status: 'Live' } : d
    ));
    setSelectedIds([]);
    triggerToast("Approved selected pending deal approvals!");
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected deals?`)) {
      setDeals(prev => prev.filter(d => !selectedIds.includes(d.id)));
      setSelectedIds([]);
      triggerToast("Selected deals successfully removed.");
    }
  };

  // Form submission handler (Deals)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSeller || formDiscount <= 0 || !formExpiry) {
      alert("Please fill out all fields.");
      return;
    }

    // Capture user expiry input and build a standard valid ISO string
    const isoExpiry = new Date(formExpiry + 'T23:59:59.000Z').toISOString();

    if (editingDeal) {
      setDeals(prev => prev.map(d => d.id === editingDeal.id ? {
        ...d,
        name: formName,
        seller: formSeller,
        discount: Number(formDiscount),
        category: formCategory,
        type: formType,
        expiry: isoExpiry,
        promoCode: formPromoCode || undefined
      } : d));
      triggerToast("Deal successfully updated!");
      setEditingDeal(null);
    } else {
      const newDeal: Deal = {
        id: String(Date.now()),
        name: formName,
        seller: formSeller,
        discount: Number(formDiscount),
        category: formCategory,
        type: formType,
        expiry: isoExpiry,
        clicks: 0,
        status: 'Pending',
        promoCode: formPromoCode || undefined
      };
      setDeals(prev => [newDeal, ...prev]);
      triggerToast("New deal launched (Pending admin verification).");
      setIsAdding(false);
    }
  };

  // Form submission handler (Promo Codes)
  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoFormCode || !promoFormBrandName || promoFormValue <= 0 || !promoFormValidUntil) {
      alert("Please fill out all required promo fields.");
      return;
    }

    const uppercaseCode = promoFormCode.trim().toUpperCase();
    const discountStr = promoFormType === 'percentage' 
      ? `${promoFormValue}% OFF` 
      : `Flat ৳${promoFormValue} OFF`;

    // Calculate standardized ISO Date string
    const isoDate = new Date(promoFormValidUntil + 'T23:59:59.000Z').toISOString();

    if (editingPromo) {
      setPromoCodes(prev => prev.map(p => p.id === editingPromo.id ? {
        ...p,
        code: uppercaseCode,
        brandName: promoFormBrandName.trim(),
        discount: discountStr,
        type: promoFormType,
        value: Number(promoFormValue),
        minOrderValue: promoFormMinOrder ? Number(promoFormMinOrder) : undefined,
        maxUsage: promoFormMaxUsage ? Number(promoFormMaxUsage) : undefined,
        validUntil: isoDate
      } : p));
      triggerToast("Promo code successfully updated!");
      setEditingPromo(null);
    } else {
      const newPromo: PromoCode = {
        id: 'p_' + Date.now(),
        code: uppercaseCode,
        brandId: 'brand_' + promoFormBrandName.toLowerCase().replace(/\s+/g, '_'),
        brandName: promoFormBrandName.trim(),
        discount: discountStr,
        type: promoFormType,
        value: Number(promoFormValue),
        minOrderValue: promoFormMinOrder ? Number(promoFormMinOrder) : undefined,
        maxUsage: promoFormMaxUsage ? Number(promoFormMaxUsage) : undefined,
        usedCount: 0,
        validUntil: isoDate,
        active: true
      };
      setPromoCodes(prev => [newPromo, ...prev]);
      triggerToast("New promo code launched successfully.");
      setIsAddingPromo(false);
    }
  };

  // Status Badge Styling map
  const getStatusBadgeStyleAndClasses = (status: Deal['status']) => {
    switch (status) {
      case 'Live':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Pending':
        return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Expiring':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'Expired':
        return 'bg-gray-50 text-gray-400 border-gray-200';
      case 'Rejected':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-gray-50 text-gray-400 border-gray-200';
    }
  };

  // Toggle active tab settings and reset some UI states
  const switchTab = (tab: 'deals' | 'promo_codes') => {
    setActiveTab(tab);
    setSearchTerm('');
    setSelectedIds([]);
  };

  const isFormActive = isAdding || editingDeal || isAddingPromo || editingPromo;

  // Render metric items dynamically depending on activeTab
  const metrics = activeTab === 'deals' ? [
    { label: 'Total Deals', val: computedStats.total, color: 'border-l-[#F4631E]' },
    { label: 'Live Deals', val: computedStats.live, color: 'border-l-green-600' },
    { label: 'Pending Approval', val: computedStats.pending, color: 'border-l-orange-400' },
    { label: 'Expiring 48h', val: computedStats.expiring48h, color: 'border-l-red-600' },
  ] : [
    { label: 'Total Promo Codes', val: promoStats.total, color: 'border-l-[#F4631E]' },
    { label: 'Active Promotions', val: promoStats.active, color: 'border-l-green-600' },
    { label: 'Expired Promo Codes', val: promoStats.expired, color: 'border-l-red-600' },
    { label: 'Code Redemptions', val: promoStats.totalUses, color: 'border-l-indigo-600' },
  ];

  return (
    <div className="space-y-6 text-[#1A1A2E]">
      
      {/* Tab Selector Headers */}
      <div className="flex border-b border-gray-200 gap-2 mb-2">
        <button
          onClick={() => switchTab('deals')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 outline-none ${
            activeTab === 'deals' 
              ? 'border-[#F4631E] text-[#F4631E]' 
              : 'border-transparent text-gray-500 hover:text-[#F4631E]'
          }`}
        >
          🏷️ Active Deals Manager
        </button>
        <button
          onClick={() => switchTab('promo_codes')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 outline-none ${
            activeTab === 'promo_codes' 
              ? 'border-[#F4631E] text-[#F4631E]' 
              : 'border-transparent text-gray-500 hover:text-[#F4631E]'
          }`}
        >
          🎟️ Promo Code Manager
        </button>
      </div>

      {/* Dynamic top metrics bar cards updated depend on activeTab */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(s => (
          <div key={s.label} className={`bg-white p-4 rounded-xl border-l-[3px] shadow-sm ${s.color} text-left`}>
             <div className="text-2xl font-bold text-[#1A1A2E]">{s.val}</div>
             <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Control bar: search, dynamic filters button, create card triggers */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'deals' ? "Search deals by name or seller..." : "Search promotions by code or brand name..."} 
            className="flex-1 bg-transparent text-[12px] outline-none text-[#1A1A2E]" 
          />
        </div>
        
        {/* Actions panel alignment */}
        <div className="flex gap-2 relative">
          
          {activeTab === 'deals' && (
            <div className="relative">
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="bg-[#F4631E] hover:bg-orange-600 text-white px-4 py-2 h-full rounded-lg text-xs font-bold shadow-lg shadow-orange-500/10 flex items-center gap-1.5 transition cursor-pointer border-none"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>

              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl p-4 w-60 z-50 text-left text-xs space-y-3">
                  <div>
                     <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status Filter</label>
                     <select 
                       value={statusFilter}
                       onChange={(e) => setStatusFilter(e.target.value)}
                       className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-[#1A1A2E] outline-none"
                     >
                        <option value="All">All Statuses</option>
                        <option value="Live">Live</option>
                        <option value="Pending">Pending</option>
                        <option value="Expiring">Expiring</option>
                        <option value="Expired">Expired</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Category Filter</label>
                     <select
                       value={categoryFilter}
                       onChange={(e) => setCategoryFilter(e.target.value)}
                       className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-[#1A1A2E] outline-none"
                     >
                        <option value="All">All Categories</option>
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                     </select>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 items-center">
                     <button 
                       onClick={() => { setStatusFilter('All'); setCategoryFilter('All'); }}
                       className="text-[10px] text-gray-400 font-bold hover:text-gray-600 bg-transparent border-none cursor-pointer"
                     >
                       Reset Filters
                     </button>
                     <button 
                       onClick={() => setShowFilterDropdown(false)}
                       className="text-[10px] text-[#F4631E] font-black uppercase hover:underline bg-transparent border-none cursor-pointer"
                     >
                       Close
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() => {
              if (activeTab === 'deals') {
                setEditingDeal(null);
                setEditingPromo(null);
                setIsAdding(true);
              } else {
                setEditingDeal(null);
                setEditingPromo(null);
                setIsAddingPromo(true);
              }
            }}
            className="bg-white hover:bg-slate-50 text-[#F4631E] border border-[#F4631E]/40 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'deals' ? 'Create Deal' : 'Create Promo Code'}</span>
          </button>
        </div>
      </div>

      {/* Main layout with responsive columns changing dynamically depending on forms panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Dynamic column sizing */}
        <div className={isFormActive ? "lg:col-span-8 space-y-6 w-full overflow-x-auto" : "lg:col-span-12 space-y-6 w-full"}>
          
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            
            {activeTab === 'deals' ? (
              <table className="w-full text-left table-auto">
                <thead className="bg-[#F7F8FA] border-b border-gray-100">
                   <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                     <th className="p-4 w-10">
                       <input 
                         type="checkbox" 
                         checked={allFilteredSelected}
                         onChange={handleSelectAllToggle}
                         className="cursor-pointer font-bold rounded"
                       />
                     </th>
                     <th className="p-4">Deal Name</th>
                     <th className="p-4">Seller</th>
                     <th className="p-4">Discount</th>
                     <th className="p-4">Expires</th>
                     <th className="p-4 animate-pulse">Clicks</th>
                     <th className="p-4">Status</th>
                     <th className="p-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {filteredDeals.map(deal => {
                     const dynamicStatus = getComputedStatus(deal);
                     const isExpiring = dynamicStatus === 'Expiring';
                     return (
                       <tr key={deal.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.includes(deal.id)}
                              onChange={() => handleSelectToggle(deal.id)}
                              className="cursor-pointer rounded"
                            />
                          </td>
                          <td className="p-4 font-bold text-[12px] text-[#0D1B2A] max-w-[200px] truncate">
                            {deal.name}
                            {deal.type === 'wholesale' && (
                              <span className="ml-1.5 text-[8px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">Bulk</span>
                            )}
                          </td>
                          <td className="p-4 text-[11px] text-gray-500">{deal.seller}</td>
                          <td className="p-4">
                            <span className="bg-[#F4631E] text-white px-2 py-0.5 rounded text-[10px] font-bold">{deal.discount}% OFF</span>
                          </td>
                          <td className={`p-4 text-[10px] flex items-center gap-1.5 mt-2.5 ${isExpiring ? 'text-red-650' : 'text-gray-400'}`}>
                            {isExpiring && <Clock className="w-3.5 h-3.5" />} {getExpiryDisplay(deal.expiry)}
                          </td>
                          <td className="p-4 text-[11px] font-medium text-gray-700">{deal.clicks.toLocaleString()}</td>
                          <td className="p-4">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-tighter ${getStatusBadgeStyleAndClasses(dynamicStatus)}`}>
                              {dynamicStatus}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-2 justify-end">
                               
                               {/* Condition: Pending deal actions */}
                               {dynamicStatus === 'Pending' ? (
                                 <>
                                   <button 
                                     onClick={() => handleApprove(deal.id)} 
                                     className="p-1 text-green-600 hover:bg-green-50 rounded border border-green-100 cursor-pointer transition"
                                     title="Approve / Publish Live"
                                   >
                                     <CheckCircle className="w-4 h-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleReject(deal.id)} 
                                     className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition"
                                     title="Reject Request"
                                   >
                                     <XCircle className="w-4 h-4" />
                                   </button>
                                 </>
                               ) : (
                                 <>
                                   {/* Condition: Live / expiring deals have Pause equivalent */}
                                   {(dynamicStatus === 'Live' || dynamicStatus === 'Expiring') ? (
                                     <button 
                                       onClick={() => handlePause(deal.id)} 
                                       className="p-1 text-amber-600 hover:bg-amber-50 rounded border border-amber-100 cursor-pointer transition"
                                       title="Pause / End Deal"
                                     >
                                       <Pause className="w-4 h-4" />
                                     </button>
                                   ) : null}
                                   
                                   <button 
                                     onClick={() => handleDelete(deal.id)} 
                                     className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition"
                                     title="Remove Deal"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                 </>
                               )}

                               {/* Edit button populated on all rows */}
                               <button 
                                 onClick={() => setEditingDeal(deal)} 
                                 className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-100 cursor-pointer transition"
                                 title="Edit Deal Specifications"
                               >
                                 <Edit3 className="w-4 h-4" />
                               </button>
                            </div>
                          </td>
                       </tr>
                     );
                   })}

                   {filteredDeals.length === 0 && (
                     <tr>
                       <td colSpan={8} className="p-8 text-center text-xs text-gray-400 italic">
                         No matching deals currently listed inside database dashboard.
                       </td>
                     </tr>
                   )}
                </tbody>
              </table>
            ) : (
              // Promo Codes Tab Table View
              <table className="w-full text-left table-auto">
                <thead className="bg-[#F7F8FA] border-b border-gray-100">
                   <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                     <th className="p-4">Code</th>
                     <th className="p-4">Brand</th>
                     <th className="p-4">Discount</th>
                     <th className="p-4">Type</th>
                     <th className="p-4">Min Order</th>
                     <th className="p-4">Used / Max</th>
                     <th className="p-4">Valid Until</th>
                     <th className="p-4">Active</th>
                     <th className="p-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {filteredPromoCodes.map(promo => {
                     const expired = isPromoExpired(promo);
                     return (
                       <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4">
                            <span className="font-mono bg-orange-100 border border-orange-200 text-[#F4631E] px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider select-all">
                              {promo.code}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-bold text-[#0D1B2A]">{promo.brandName}</td>
                          <td className="p-4 text-xs font-semibold text-[#F4631E]">{promo.discount}</td>
                          <td className="p-4 text-xs uppercase text-gray-500 font-mono tracking-tight">{promo.type}</td>
                          <td className="p-4 text-xs text-gray-700">
                            {promo.minOrderValue ? `৳ ${promo.minOrderValue.toLocaleString()}` : "৳ 0"}
                          </td>
                          <td className="p-4 text-xs text-gray-600">
                            <span className="font-bold">{promo.usedCount}</span>
                            {promo.maxUsage ? ` / ${promo.maxUsage}` : " / ∞"}
                          </td>
                          <td className="p-4 text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={expired ? "text-red-500 font-bold" : "text-gray-600"}>
                                {new Date(promo.validUntil).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {expired && (
                                <span className="bg-red-500/10 text-red-600 border border-red-500/10 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider whitespace-nowrap">
                                  Expired
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={promo.active && !expired}
                                disabled={expired}
                                onChange={(e) => {
                                  if (expired) return;
                                  const val = e.target.checked;
                                  setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, active: val } : p));
                                  triggerToast(`Promo code ${promo.code} ${val ? 'activated' : 'deactivated'}.`);
                                }}
                                className="sr-only peer"
                              />
                              <div className={`w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600 ${expired ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}></div>
                            </label>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => {
                                  setEditingPromo(promo);
                                  setIsAddingPromo(false);
                                }} 
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-100 cursor-pointer transition"
                                title="Edit Promo Code"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete promo code ${promo.code}?`)) {
                                    setPromoCodes(prev => prev.filter(p => p.id !== promo.id));
                                    triggerToast(`Promo code ${promo.code} deleted successfully.`);
                                  }
                                }} 
                                className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition"
                                title="Delete Promo Code"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                       </tr>
                     );
                   })}

                   {filteredPromoCodes.length === 0 && (
                     <tr>
                       <td colSpan={9} className="p-8 text-center text-xs text-gray-400 italic">
                         No matching promo codes currently list under this search value.
                       </td>
                     </tr>
                   )}
                </tbody>
              </table>
            )}
            
          </div>
        </div>

        {/* Dynamic drawer side form: handles both Deals and Promo Codes depend on tab */}
        <AnimatePresence mode="wait">
          {isFormActive && (
            <div className="lg:col-span-4 h-fit sticky top-24">
              <motion.div 
                key={activeTab === 'deals' ? "form-deal" : "form-promo"}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-2xl text-left space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#1a1a2e] flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#F4631E]" />
                    <span>
                      {activeTab === 'deals' 
                        ? (editingDeal ? 'Modify Custom Deal' : 'Publish New Deal')
                        : (editingPromo ? 'Modify Promo Code' : 'Create Promo Code')
                      }
                    </span>
                  </h3>
                  <button 
                    onClick={() => { 
                      setIsAdding(false); 
                      setEditingDeal(null); 
                      setIsAddingPromo(false); 
                      setEditingPromo(null); 
                    }}
                    className="p-1.5 text-slate-400 hover:text-[#F4631E] rounded-xl text-xs font-bold transition cursor-pointer bg-transparent border-none"
                  >
                    Cancel
                  </button>
                </div>

                {activeTab === 'deals' ? (
                  // DEALS SECTOR FORM
                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Deal Label Name</label>
                      <input 
                        type="text" 
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Walton Smart TV Discount"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Seller Business Name</label>
                      <input 
                        type="text" 
                        required
                        value={formSeller}
                        onChange={(e) => setFormSeller(e.target.value)}
                        placeholder="e.g. ElectroBD Dhaka"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Discount Percentage</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          max="100"
                          value={formDiscount || ''}
                          onChange={(e) => setFormDiscount(Number(e.target.value))}
                          placeholder="e.g. 15"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Category</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        >
                          <option value="Electronics">Electronics</option>
                          <option value="Home">Home</option>
                          <option value="Fashion">Fashion</option>
                          <option value="Beauty">Beauty</option>
                          <option value="Groceries">Groceries</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Target Deal Type</label>
                        <select
                          value={formType}
                          onChange={(e) => setFormType(e.target.value as 'retail' | 'wholesale')}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        >
                          <option value="retail">Retail (Shopper)</option>
                          <option value="wholesale">Wholesale (Bulk)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Expiry Date</label>
                        <input 
                          type="date"
                          required
                          value={formExpiry}
                          onChange={(e) => setFormExpiry(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 text-left">Coupon Code (Optional)</label>
                      <input 
                        type="text"
                        value={formPromoCode}
                        onChange={(e) => setFormPromoCode(e.target.value)}
                        placeholder="e.g. SAVINGS25"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 bg-[#F4631E] hover:bg-orange-600 text-white font-extrabold uppercase tracking-wide rounded-xl text-xs shadow-lg shadow-orange-500/10 cursor-pointer transition border-none mt-4"
                    >
                      {editingDeal ? 'Apply Updates' : 'Publish / Add Deal'}
                    </button>
                  </form>
                ) : (
                  // PROMO CODES SECTOR FORM
                  <form onSubmit={handlePromoSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Promo Code (Uppercase)</label>
                      <input 
                        type="text" 
                        required
                        value={promoFormCode}
                        onChange={(e) => setPromoFormCode(e.target.value.toUpperCase())}
                        placeholder="e.g. AARONG20"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E] font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Brand Name</label>
                      <input 
                        type="text" 
                        required
                        value={promoFormBrandName}
                        onChange={(e) => setPromoFormBrandName(e.target.value)}
                        placeholder="e.g. Aarong, Apex, Sailor, etc."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Discount Type</label>
                        <select
                          value={promoFormType}
                          onChange={(e) => setPromoFormType(e.target.value as 'percentage' | 'flat')}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Cash (৳)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Discount Value</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          value={promoFormValue || ''}
                          onChange={(e) => setPromoFormValue(Number(e.target.value))}
                          placeholder={promoFormType === 'percentage' ? "e.g. 15" : "e.g. 500"}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Min Order Value (৳)</label>
                        <input 
                          type="number" 
                          value={promoFormMinOrder || ''}
                          onChange={(e) => setPromoFormMinOrder(Number(e.target.value))}
                          placeholder="e.g. 2500"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Max Usage Count</label>
                        <input 
                          type="number" 
                          value={promoFormMaxUsage || ''}
                          onChange={(e) => setPromoFormMaxUsage(Number(e.target.value))}
                          placeholder="e.g. 500"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Valid Until Date</label>
                      <input 
                        type="date"
                        required
                        value={promoFormValidUntil}
                        onChange={(e) => setPromoFormValidUntil(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-[#1a1a2e] outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3 bg-[#F4631E] hover:bg-orange-600 text-white font-extrabold uppercase tracking-wide rounded-xl text-xs shadow-lg shadow-orange-500/10 cursor-pointer transition border-none mt-4"
                    >
                      {editingPromo ? 'Apply Promo Updates' : 'Launch Promo Code'}
                    </button>
                  </form>
                )}

              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      {/* Bulk actions menu bar popping on checkboxes selection for Deals */}
      <AnimatePresence>
        {activeTab === 'deals' && selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-32 z-55 bg-[#1A1A2E] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 border border-[#F4631E]/30"
          >
            <div className="flex items-center gap-2 text-left">
              <span className="w-5 h-5 bg-[#F4631E] rounded-full text-[10px] font-black flex items-center justify-center text-white">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Selected Deals</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-700" />
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border-none"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>
              <button
                onClick={handleBulkDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-white font-bold text-xs px-2 py-1.5 bg-transparent border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating interactive notification system */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-[600] bg-[#1A1A2E] border border-[#F4631E]/30 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
