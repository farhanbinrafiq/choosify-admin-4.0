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
  X,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../../services/catalogApi';
import { StatTile } from '../../components/ui/StatTile';
import type { CatalogDeal } from '../../types/catalog';

// Deals now use the real catalog contract — the client is the source of truth
// for shape (see src/types/catalog.ts CatalogDeal / server/catalogRouter.ts).
export type Deal = CatalogDeal;

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

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

export default function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Group 2: this page manages Deals only. Promo codes / vouchers have their
  // own real, Operations-backed surface at /admin/coupons — the former
  // in-page "Promo Code Manager" tab was local mock data and has been retired.
  // activeTab stays a union for the legacy render branches but is pinned to 'deals'.
  const [activeTab] = useState<'deals' | 'promo_codes'>('deals');

  useEffect(() => {
    if (searchParams.get('tab') === 'promocodes') {
      navigate('/admin/coupons', { replace: true });
    }
  }, [searchParams, navigate]);

  // Deals are loaded from the real catalog API (GET /catalog/deals) — no more local seed data.
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  const loadDeals = async () => {
    setDealsLoading(true);
    setDealsError(null);
    try {
      const data = await catalogApi.listDeals();
      setDeals(data);
    } catch (err) {
      setDealsError(err instanceof Error ? err.message : 'Failed to load deals.');
    } finally {
      setDealsLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, []);

  // Promo codes remain local/mock — there is no backend for them yet.
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showBulkDeleteForm, setShowBulkDeleteForm] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [bulkActionPending, setBulkActionPending] = useState(false);

  // Form slide-in state managers (Deals)
  const [isAdding, setIsAdding] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [savingDeal, setSavingDeal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form slide-in state managers (Promo Codes)
  const [isAddingPromo, setIsAddingPromo] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);

  // Form input states (Deals) — field names follow the real CatalogDeal contract.
  const [formName, setFormName] = useState('');
  const [formSeller, setFormSeller] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0);
  const [formCategory, setFormCategory] = useState('Electronics');
  const [formValidUntil, setFormValidUntil] = useState('');
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
    setFormError(null);
    if (editingDeal) {
      setFormName(editingDeal.name);
      setFormSeller(editingDeal.seller);
      setFormDiscountType(editingDeal.discountType === 'flat' ? 'flat' : 'percentage');
      setFormDiscountValue(editingDeal.discountValue);
      setFormCategory(editingDeal.category);

      const parsedDate = new Date(editingDeal.validUntil);
      const yyyy = parsedDate.getFullYear();
      const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(parsedDate.getDate()).padStart(2, '0');
      setFormValidUntil(`${yyyy}-${mm}-${dd}`);
      setFormPromoCode(editingDeal.promoCode || '');
      setIsAdding(false);
    } else if (isAdding) {
      setFormName('');
      setFormSeller('');
      setFormDiscountType('percentage');
      setFormDiscountValue(0);
      setFormCategory('Electronics');

      // Default to 48 hours tomorrow YYYY-MM-DD
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      setFormValidUntil(`${yyyy}-${mm}-${dd}`);
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
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Condition check: Expiring status automatically computed if deal expires within 48 hours
  const isExpiringWithin48h = (validUntilStr: string, currentStatus: Deal['status']) => {
    if (currentStatus === 'expired' || currentStatus === 'rejected') return false;
    const expiry = new Date(validUntilStr).getTime();
    const now = new Date().getTime();
    const diffHours = (expiry - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  };

  // Condition check: Expired status automatically computed if current date is past expiry
  const isExpiredDeal = (validUntilStr: string) => {
    return new Date(validUntilStr).getTime() < new Date().getTime();
  };

  // Get raw/computed status dynamically
  const getComputedStatus = (deal: Deal): Deal['status'] => {
    if (deal.status === 'rejected') return 'rejected';
    if (deal.status === 'expired' || isExpiredDeal(deal.validUntil)) return 'expired';
    if (isExpiringWithin48h(deal.validUntil, deal.status)) return 'expiring';
    return deal.status;
  };

  // Expiry display string builder helper (dynamic or formatted)
  const getExpiryDisplay = (validUntilStr: string) => {
    const expiry = new Date(validUntilStr).getTime();
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

    return new Date(validUntilStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if promo code is expired
  const isPromoExpired = (promo: PromoCode) => {
    return new Date(promo.validUntil).getTime() < Date.now();
  };

  // Dynamically compute global catalog stats from the loaded state (not cached list)
  const computedStats = useMemo(() => {
    const rawDeals = deals.map(d => ({
      ...d,
      computedStatus: getComputedStatus(d)
    }));

    return {
      total: rawDeals.length,
      live: rawDeals.filter(d => d.computedStatus === 'live').length,
      pending: rawDeals.filter(d => d.computedStatus === 'pending').length,
      expiring48h: rawDeals.filter(d => d.computedStatus === 'expiring').length
    };
  }, [deals]);

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

  // Actions handler implementations (Deals) — each now calls the real API and
  // only updates local state once the request has actually succeeded.
  const handleApprove = async (id: string) => {
    setActionPendingId(id);
    try {
      const updated = await catalogApi.updateDeal(id, { status: 'live' });
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
      triggerToast("Deal successfully approved and made Live!");
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Failed to approve deal.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionPendingId(id);
    try {
      const updated = await catalogApi.updateDeal(id, { status: 'rejected' });
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
      triggerToast("Deal request rejected.");
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Failed to reject deal.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionPendingId(id);
    try {
      const updated = await catalogApi.updateDeal(id, { status: 'expired' });
      setDeals(prev => prev.map(d => d.id === id ? updated : d));
      triggerToast("Deal paused (moved to expired state).");
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Failed to pause deal.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionPendingId(id);
    try {
      await catalogApi.deleteDeal(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      triggerToast("Deal removed successfully.");
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Failed to delete deal.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  // Bulk actions handlers
  const handleBulkApprove = async () => {
    const targets = deals.filter(d => selectedIds.includes(d.id) && d.status === 'pending');
    if (targets.length === 0) {
      setSelectedIds([]);
      return;
    }
    setBulkActionPending(true);
    const results = await Promise.allSettled(targets.map(d => catalogApi.updateDeal(d.id, { status: 'live' })));
    const updatedById = new Map<string, Deal>();
    let failCount = 0;
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        updatedById.set(targets[idx].id, result.value);
      } else {
        failCount += 1;
      }
    });
    setDeals(prev => prev.map(d => updatedById.get(d.id) ?? d));
    setSelectedIds([]);
    setBulkActionPending(false);
    if (failCount === 0) {
      triggerToast("Approved selected pending deal approvals!");
    } else {
      triggerToast(`Approved ${updatedById.size} deal(s); ${failCount} failed.`, 'error');
    }
  };

  const handleBulkDelete = async () => {
    const targetIds = [...selectedIds];
    if (targetIds.length === 0) return;
    setBulkActionPending(true);
    const results = await Promise.allSettled(targetIds.map(id => catalogApi.deleteDeal(id)));
    const succeededIds = new Set<string>();
    let failCount = 0;
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        succeededIds.add(targetIds[idx]);
      } else {
        failCount += 1;
      }
    });
    setDeals(prev => prev.filter(d => !succeededIds.has(d.id)));
    setSelectedIds(prev => prev.filter(id => !succeededIds.has(id)));
    setBulkActionPending(false);
    if (failCount === 0) {
      triggerToast("Selected deals successfully removed.");
    } else {
      triggerToast(`Removed ${succeededIds.size} deal(s); ${failCount} failed.`, 'error');
    }
  };

  // Form submission handler (Deals)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSeller || formDiscountValue <= 0 || !formValidUntil) {
      setFormError("Please fill out all fields.");
      return;
    }

    // Capture user expiry input and build a standard valid ISO string
    const isoValidUntil = new Date(formValidUntil + 'T23:59:59.000Z').toISOString();

    const payload: Partial<CatalogDeal> = {
      name: formName,
      seller: formSeller,
      category: formCategory,
      discountType: formDiscountType,
      discountValue: Number(formDiscountValue),
      validUntil: isoValidUntil,
      promoCode: formPromoCode || undefined,
    };

    setSavingDeal(true);
    setFormError(null);
    try {
      if (editingDeal) {
        const updated = await catalogApi.updateDeal(editingDeal.id, payload);
        setDeals(prev => prev.map(d => d.id === editingDeal.id ? updated : d));
        triggerToast("Deal successfully updated!");
        setEditingDeal(null);
      } else {
        const created = await catalogApi.createDeal({ ...payload, status: 'pending' });
        setDeals(prev => [created, ...prev]);
        triggerToast("New deal launched (Pending admin verification).");
        setIsAdding(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save deal.');
    } finally {
      setSavingDeal(false);
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
      case 'live':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'expiring':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'expired':
        return 'bg-gray-50 text-gray-400 border-gray-200';
      case 'rejected':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-gray-50 text-gray-400 border-gray-200';
    }
  };

  // Deals-only page now; the Promo Code tab redirects to /admin/coupons.
  const switchTab = (tab: 'deals' | 'promo_codes') => {
    if (tab === 'promo_codes') {
      navigate('/admin/coupons');
      return;
    }
    setSearchTerm('');
    setSelectedIds([]);
    setSearchParams({});
  };

  const isFormActive = isAdding || editingDeal || isAddingPromo || editingPromo;

  // Real, deals-derived metrics only (no fabricated promo-code stats).
  const metrics: Array<{ label: string; val: number; accent: 'orange' | 'emerald' | 'rose' }> = [
    { label: 'Total Deals', val: computedStats.total, accent: 'orange' },
    { label: 'Live Deals', val: computedStats.live, accent: 'emerald' },
    { label: 'Pending Approval', val: computedStats.pending, accent: 'orange' },
    { label: 'Expiring 48h', val: computedStats.expiring48h, accent: 'rose' },
  ];

  return (
    <div className="space-y-6 text-[#111827]">

      {/* Tab Selector Headers */}
      <div className="flex border-b border-gray-200 gap-2 mb-2">
        <button
          onClick={() => switchTab('deals')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 outline-none ${
            activeTab === 'deals'
              ? 'border-[#FF5B00] text-[#FF5B00]'
              : 'border-transparent text-gray-500 hover:text-[#FF5B00]'
          }`}
        >
          🏷️ Active Deals Manager
        </button>
        <button
          onClick={() => switchTab('promo_codes')}
          className="px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-gray-500 hover:text-[#FF5B00] transition-all cursor-pointer flex items-center gap-2 outline-none"
          title="Promo codes & vouchers are managed on their own page"
        >
          🎟️ Promo Codes &amp; Vouchers <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Real deals-derived metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(s => (
          <StatTile key={s.label} label={s.label} value={s.val} accent={s.accent} />
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
            className="flex-1 bg-transparent text-[12px] outline-none text-[#111827]"
          />
        </div>

        {/* Actions panel alignment */}
        <div className="flex gap-2 relative">

          {activeTab === 'deals' && (
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="bg-[#FF5B00] hover:bg-orange-600 text-white px-4 py-2 h-full rounded-lg text-xs font-bold shadow-lg shadow-orange-500/10 flex items-center gap-1.5 transition cursor-pointer border-none"
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
                       className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-[#111827] outline-none"
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
                       className="w-full bg-slate-50 border border-gray-200 rounded-lg p-2 text-xs text-[#111827] outline-none"
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
                       className="text-[10px] text-[#FF5B00] font-black uppercase hover:underline bg-transparent border-none cursor-pointer"
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
            className="bg-white hover:bg-slate-50 text-[#FF5B00] border border-[#FF5B00]/40 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
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
              dealsLoading ? (
                <div className="p-10 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs font-bold">Loading deals…</span>
                </div>
              ) : dealsError ? (
                <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-xs font-bold text-red-600 max-w-sm">{dealsError}</span>
                  <button
                    onClick={loadDeals}
                    className="px-3 py-1.5 bg-[#FF5B00] hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-colors border-none"
                  >
                    Retry
                  </button>
                </div>
              ) : (
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
                     <th className="p-4">Clicks</th>
                     <th className="p-4">Status</th>
                     <th className="p-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {filteredDeals.map(deal => {
                     const dynamicStatus = getComputedStatus(deal);
                     const isExpiring = dynamicStatus === 'expiring';
                     const rowPending = actionPendingId === deal.id;
                     return (
                       <tr key={deal.id} className={`hover:bg-gray-50/50 transition-colors ${rowPending ? 'opacity-60' : ''}`}>
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(deal.id)}
                              onChange={() => handleSelectToggle(deal.id)}
                              className="cursor-pointer rounded"
                            />
                          </td>
                          <td className="p-4 font-bold text-[12px] text-[#111827] max-w-[200px] truncate">
                            {deal.name}
                          </td>
                          <td className="p-4 text-[11px] text-gray-500">{deal.seller}</td>
                          <td className="p-4">
                            <span className="bg-[#FF5B00] text-white px-2 py-0.5 rounded text-[10px] font-bold">
                              {deal.discountType === 'flat' ? `৳${deal.discountValue} OFF` : `${deal.discountValue}% OFF`}
                            </span>
                          </td>
                          <td className={`p-4 text-[10px] flex items-center gap-1.5 mt-2.5 ${isExpiring ? 'text-red-650' : 'text-gray-400'}`}>
                            {isExpiring && <Clock className="w-3.5 h-3.5" />} {getExpiryDisplay(deal.validUntil)}
                          </td>
                          <td className="p-4 text-[11px] font-medium text-gray-700">{deal.clicks ? deal.clicks.toLocaleString() : '—'}</td>
                          <td className="p-4">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-tighter ${getStatusBadgeStyleAndClasses(dynamicStatus)}`}>
                              {capitalize(dynamicStatus)}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex gap-2 justify-end">

                                 {/* Condition: Pending deal actions */}
                                 {dynamicStatus === 'pending' ? (
                                   <>
                                     <button
                                       onClick={() => handleApprove(deal.id)}
                                       disabled={rowPending}
                                       className="p-1 text-green-600 hover:bg-green-50 rounded border border-green-100 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                       title="Approve / Publish Live"
                                     >
                                       <CheckCircle className="w-4 h-4" />
                                     </button>
                                     <button
                                       onClick={() => handleReject(deal.id)}
                                       disabled={rowPending}
                                       className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                       title="Reject Request"
                                     >
                                       <XCircle className="w-4 h-4" />
                                     </button>
                                   </>
                                 ) : (
                                   <>
                                     {/* Condition: Live / expiring deals have Pause equivalent */}
                                     {(dynamicStatus === 'live' || dynamicStatus === 'expiring') ? (
                                       <button
                                         onClick={() => handlePause(deal.id)}
                                         disabled={rowPending}
                                         className="p-1 text-amber-600 hover:bg-amber-50 rounded border border-amber-100 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                         title="Pause / End Deal"
                                       >
                                         <Pause className="w-4 h-4" />
                                       </button>
                                     ) : null}

                                     <button
                                       onClick={() => setConfirmingId(deal.id)}
                                       disabled={rowPending}
                                       className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                       title="Remove Deal"
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                   </>
                                 )}

                                 {/* Edit button populated on all rows */}
                                 <button
                                   onClick={() => setEditingDeal(deal)}
                                   disabled={rowPending}
                                   className="p-1 text-blue-600 hover:bg-blue-50 rounded border border-blue-100 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                                   title="Edit Deal Specifications"
                                 >
                                   <Edit3 className="w-4 h-4" />
                                 </button>
                              </div>
                              {confirmingId === deal.id && (
                                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex flex-col items-end gap-1 z-10">
                                  <span className="text-[9px] font-black text-red-600">Delete deal?</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => { handleDelete(deal.id); setConfirmingId(null); }}
                                      className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded hover:bg-red-600 transition-colors border border-transparent"
                                    >Confirm</button>
                                    <button
                                      onClick={() => setConfirmingId(null)}
                                      className="px-2 py-1 bg-white border border-slate-250 text-slate-600 text-[8px] font-black uppercase rounded hover:bg-slate-50 transition-colors"
                                    >Cancel</button>
                                  </div>
                                </div>
                              )}
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
              )
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
                            <span className="font-mono bg-orange-100 border border-orange-200 text-[#FF5B00] px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider select-all">
                              {promo.code}
                            </span>
                          </td>
                          <td className="p-4 text-xs font-bold text-[#111827]">{promo.brandName}</td>
                          <td className="p-4 text-xs font-semibold text-[#FF5B00]">{promo.discount}</td>
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
                            <div className="flex flex-col items-end gap-1">
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
                                  onClick={() => setConfirmingId(promo.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-100 cursor-pointer transition"
                                  title="Delete Promo Code"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              {confirmingId === promo.id && (
                                <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex flex-col items-end gap-1 z-10">
                                  <span className="text-[9px] font-black text-red-600">Delete promo?</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => {
                                        setPromoCodes(prev => prev.filter(p => p.id !== promo.id));
                                        triggerToast(`Promo code ${promo.code} deleted successfully.`);
                                        setConfirmingId(null);
                                      }}
                                      className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded hover:bg-red-600 transition-colors border border-transparent"
                                    >Confirm</button>
                                    <button
                                      onClick={() => setConfirmingId(null)}
                                      className="px-2 py-1 bg-white border border-slate-250 text-slate-600 text-[8px] font-black uppercase rounded hover:bg-slate-50 transition-colors"
                                    >Cancel</button>
                                  </div>
                                </div>
                              )}
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
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#111827] flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#FF5B00]" />
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
                      setFormError(null);
                      setIsAddingPromo(false);
                      setEditingPromo(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-[#FF5B00] rounded-xl text-xs font-bold transition cursor-pointer bg-transparent border-none"
                  >
                    Cancel
                  </button>
                </div>

                {activeTab === 'deals' ? (
                  // DEALS SECTOR FORM
                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {formError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[10px] font-bold text-red-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Deal Label Name</label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Walton Smart TV Discount"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Discount Type</label>
                        <select
                          value={formDiscountType}
                          onChange={(e) => setFormDiscountType(e.target.value as 'percentage' | 'flat')}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
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
                          max={formDiscountType === 'percentage' ? 100 : undefined}
                          value={formDiscountValue || ''}
                          onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                          placeholder={formDiscountType === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                      >
                        <option value="Electronics">Electronics</option>
                        <option value="Home">Home</option>
                        <option value="Fashion">Fashion</option>
                        <option value="Beauty">Beauty</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Expiry Date</label>
                        <input
                          type="date"
                          required
                          value={formValidUntil}
                          onChange={(e) => setFormValidUntil(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                        />
                      </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5 text-left">Coupon Code (Optional)</label>
                      <input
                        type="text"
                        value={formPromoCode}
                        onChange={(e) => setFormPromoCode(e.target.value)}
                        placeholder="e.g. SAVINGS25"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingDeal}
                      className="w-full py-3 bg-[#FF5B00] hover:bg-orange-600 text-white font-extrabold uppercase tracking-wide rounded-xl text-xs shadow-lg shadow-orange-500/10 cursor-pointer transition border-none mt-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingDeal && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {savingDeal
                          ? 'Saving…'
                          : editingDeal ? 'Apply Updates' : 'Publish / Add Deal'}
                      </span>
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00] font-mono font-bold"
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Discount Type</label>
                        <select
                          value={promoFormType}
                          onChange={(e) => setPromoFormType(e.target.value as 'percentage' | 'flat')}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Max Usage Count</label>
                        <input
                          type="number"
                          value={promoFormMaxUsage || ''}
                          onChange={(e) => setPromoFormMaxUsage(Number(e.target.value))}
                          placeholder="e.g. 500"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
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
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-[#111827] outline-none focus:border-[#FF5B00]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#FF5B00] hover:bg-orange-600 text-white font-extrabold uppercase tracking-wide rounded-xl text-xs shadow-lg shadow-orange-500/10 cursor-pointer transition border-none mt-4"
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-32 z-55 bg-[#111827] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex flex-col gap-3 border border-[#FF5B00]/30 w-96 max-w-full"
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2 text-left">
                <span className="w-5 h-5 bg-[#FF5B00] rounded-full text-[10px] font-black flex items-center justify-center text-white">
                  {selectedIds.length}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Selected Deals</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkActionPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkActionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => setShowBulkDeleteForm(prev => !prev)}
                  disabled={bulkActionPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => { setSelectedIds([]); setShowBulkDeleteForm(false); }}
                  className="text-slate-400 hover:text-white font-bold text-xs px-2 py-1.5 bg-transparent border-none cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
            {showBulkDeleteForm && (
              <div className="p-3 bg-[#1F1F35] rounded-xl border border-rose-500/30 text-white flex flex-col gap-2 shadow-2xl">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Are you absolutely sure?</span>
                <span className="text-[9px] text-slate-400">This will permanently delete all {selectedIds.length} selected deals from the platform database listings.</span>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      handleBulkDelete();
                      setShowBulkDeleteForm(false);
                    }}
                    disabled={bulkActionPending}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >Confirm Bulk Delete</button>
                  <button
                    onClick={() => setShowBulkDeleteForm(false)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-colors"
                  >Cancel</button>
                </div>
              </div>
            )}
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
            className={`fixed bottom-6 right-6 z-[600] border p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white ${
              toast.type === 'error' ? 'bg-red-600 border-red-400/40' : 'bg-[#111827] border-[#FF5B00]/30'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
