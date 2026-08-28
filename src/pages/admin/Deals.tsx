import React, { useState, useMemo, useEffect, useCallback, CSSProperties } from 'react';
import {
  Clock, Search, ExternalLink, CheckCircle, XCircle, Plus, Trash2, Edit3, Pause,
  Loader2, AlertTriangle, Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogDeal } from '../../types/catalog';

// Deals use the real catalog contract — src/types/catalog.ts CatalogDeal /
// server/catalogRouter.ts (GET /catalog/deals public; POST/PATCH/DELETE gated
// by requireCmsWrite).
export type Deal = CatalogDeal;

// ============================================================================
// Sprint 13 UI regression lock — Step 3. PRESENTATION is a faithful reproduction
// of the approved standalone `isDeals` section (design-reference/Choosify Admin
// CMS (standalone).html, decoded lines 2957–2979): "Deals & Promotions" header +
// "+ Create Deal" + a Deal | Brand | Discount | Starts | Ends | Status table,
// expressed as inline styles. Sanctioned deviation: accent = var(--cms-accent),
// not the raw reference #FF5B00.
//
// FUNCTIONALITY is the current canonical layer, unchanged: catalogApi.listDeals /
// createDeal / updateDeal / deleteDeal, computed live/expiring/expired status,
// search + status + category filter, per-row approve/reject/pause/edit/delete,
// bulk approve/delete, the real deals-derived metrics, and the ?tab=promocodes
// redirect to /admin/coupons. Real controls the prototype lacks (checkbox column,
// per-row Actions, metrics, filters, the Add/Edit form) are integrated into the
// same visual system rather than dropped.
//
// The former in-page "Promo Code Manager" (5 hardcoded promo codes + its form +
// table, unreachable dead code since 75b8b4b) is removed — that surface is
// /admin/coupons, linked from the header.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const capitalize = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

/** Status pill — inline, matching the standalone status-badge chrome. */
const statusBadge = (status: Deal['status']): CSSProperties => {
  const map: Record<string, { bg: string; fg: string }> = {
    live: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
    pending: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
    expiring: { bg: 'rgba(239,68,68,0.1)', fg: '#DC2626' },
    expired: { bg: '#F1F3F5', fg: '#9CA3AF' },
    rejected: { bg: '#F1F3F5', fg: '#6B7280' },
    draft: { bg: '#F1F3F5', fg: '#6B7280' },
  };
  const c = map[status] || { bg: '#F1F3F5', fg: '#6B7280' };
  return {
    background: c.bg, color: c.fg, fontSize: 9, fontWeight: 800, letterSpacing: '0.03em',
    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  };
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Promo codes / vouchers have their own real Operations-backed surface at
  // /admin/coupons — the former in-page tab redirects there.
  useEffect(() => {
    if (searchParams.get('tab') === 'promocodes') {
      navigate('/admin/coupons', { replace: true });
    }
  }, [searchParams, navigate]);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    setDealsLoading(true);
    setDealsError(null);
    try {
      setDeals(await catalogApi.listDeals());
    } catch (err) {
      setDealsError(err instanceof Error ? err.message : 'Failed to load deals.');
    } finally {
      setDealsLoading(false);
    }
  }, []);

  useEffect(() => { void loadDeals(); }, [loadDeals]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [bulkActionPending, setBulkActionPending] = useState(false);

  // Add / Edit Deal form (real CatalogDeal contract)
  const [isAdding, setIsAdding] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [savingDeal, setSavingDeal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSeller, setFormSeller] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0);
  const [formCategory, setFormCategory] = useState('Electronics');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formPromoCode, setFormPromoCode] = useState('');

  useEffect(() => {
    setFormError(null);
    if (editingDeal) {
      setFormName(editingDeal.name);
      setFormSeller(editingDeal.seller);
      setFormDiscountType(editingDeal.discountType === 'flat' ? 'flat' : 'percentage');
      setFormDiscountValue(editingDeal.discountValue);
      setFormCategory(editingDeal.category);
      const p = new Date(editingDeal.validUntil);
      setFormValidUntil(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`);
      setFormPromoCode(editingDeal.promoCode || '');
      setIsAdding(false);
    } else if (isAdding) {
      setFormName(''); setFormSeller(''); setFormDiscountType('percentage'); setFormDiscountValue(0); setFormCategory('Electronics');
      const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setFormValidUntil(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
      setFormPromoCode('');
    }
  }, [editingDeal, isAdding]);

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── computed status (verbatim) ──
  const isExpiredDeal = (s: string) => new Date(s).getTime() < Date.now();
  const isExpiringWithin48h = (s: string, cur: Deal['status']) => {
    if (cur === 'expired' || cur === 'rejected') return false;
    const h = (new Date(s).getTime() - Date.now()) / 3.6e6;
    return h > 0 && h <= 48;
  };
  const getComputedStatus = (d: Deal): Deal['status'] => {
    if (d.status === 'rejected') return 'rejected';
    if (d.status === 'expired' || isExpiredDeal(d.validUntil)) return 'expired';
    if (isExpiringWithin48h(d.validUntil, d.status)) return 'expiring';
    return d.status;
  };
  const getExpiryDisplay = (s: string) => {
    const diff = new Date(s).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3.6e6);
    if (h < 48) return h === 0 ? `${Math.floor(diff / 6e4)}m left` : `${h}h left`;
    return fmtDate(s);
  };

  const computedStats = useMemo(() => {
    const c = deals.map((d) => getComputedStatus(d));
    return {
      total: c.length,
      live: c.filter((s) => s === 'live').length,
      pending: c.filter((s) => s === 'pending').length,
      expiring48h: c.filter((s) => s === 'expiring').length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals]);

  const uniqueCategories = useMemo(() => Array.from(new Set(deals.map((d) => d.category).filter(Boolean))), [deals]);

  const filteredDeals = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return deals.filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(q) || d.seller.toLowerCase().includes(q);
      const cs = getComputedStatus(d);
      const matchesStatus = statusFilter === 'All' || cs.toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === 'All' || d.category.toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesCategory;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, searchTerm, statusFilter, categoryFilter]);

  const allFilteredSelected = filteredDeals.length > 0 && filteredDeals.every((d) => selectedIds.includes(d.id));
  const toggleSelectAll = () => {
    const ids = filteredDeals.map((d) => d.id);
    setSelectedIds((prev) => (allFilteredSelected ? prev.filter((i) => !ids.includes(i)) : Array.from(new Set([...prev, ...ids]))));
  };
  const toggleSelect = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  // ── per-row actions (verbatim) ──
  const patchStatus = async (id: string, status: Deal['status'], okMsg: string, failMsg: string) => {
    setActionPendingId(id);
    try {
      const updated = await catalogApi.updateDeal(id, { status });
      setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
      triggerToast(okMsg);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : failMsg, 'error');
    } finally {
      setActionPendingId(null);
    }
  };
  const handleApprove = (id: string) => patchStatus(id, 'live', 'Deal approved and made Live.', 'Failed to approve deal.');
  const handleReject = (id: string) => patchStatus(id, 'rejected', 'Deal request rejected.', 'Failed to reject deal.');
  const handlePause = (id: string) => patchStatus(id, 'expired', 'Deal paused (moved to expired).', 'Failed to pause deal.');

  const handleDelete = async (id: string) => {
    setActionPendingId(id);
    try {
      await catalogApi.deleteDeal(id);
      setDeals((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      triggerToast('Deal removed.');
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Failed to delete deal.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleBulkApprove = async () => {
    const targets = deals.filter((d) => selectedIds.includes(d.id) && getComputedStatus(d) === 'pending');
    if (targets.length === 0) { setSelectedIds([]); return; }
    setBulkActionPending(true);
    const results = await Promise.allSettled(targets.map((d) => catalogApi.updateDeal(d.id, { status: 'live' })));
    const updated = new Map<string, Deal>();
    let fails = 0;
    results.forEach((r, i) => (r.status === 'fulfilled' ? updated.set(targets[i].id, r.value) : (fails += 1)));
    setDeals((prev) => prev.map((d) => updated.get(d.id) ?? d));
    setSelectedIds([]);
    setBulkActionPending(false);
    triggerToast(fails === 0 ? 'Approved selected pending deals.' : `Approved ${updated.size}; ${fails} failed.`, fails === 0 ? 'success' : 'error');
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActionPending(true);
    const results = await Promise.allSettled(ids.map((id) => catalogApi.deleteDeal(id)));
    const done = new Set<string>();
    let fails = 0;
    results.forEach((r, i) => (r.status === 'fulfilled' ? done.add(ids[i]) : (fails += 1)));
    setDeals((prev) => prev.filter((d) => !done.has(d.id)));
    setSelectedIds((prev) => prev.filter((i) => !done.has(i)));
    setBulkActionPending(false);
    triggerToast(fails === 0 ? 'Selected deals removed.' : `Removed ${done.size}; ${fails} failed.`, fails === 0 ? 'success' : 'error');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formSeller || formDiscountValue <= 0 || !formValidUntil) {
      setFormError('Please fill out all fields.');
      return;
    }
    const payload: Partial<CatalogDeal> = {
      name: formName,
      seller: formSeller,
      category: formCategory,
      discountType: formDiscountType,
      discountValue: Number(formDiscountValue),
      validUntil: new Date(`${formValidUntil}T23:59:59.000Z`).toISOString(),
      promoCode: formPromoCode || undefined,
    };
    setSavingDeal(true);
    setFormError(null);
    try {
      if (editingDeal) {
        const updated = await catalogApi.updateDeal(editingDeal.id, payload);
        setDeals((prev) => prev.map((d) => (d.id === editingDeal.id ? updated : d)));
        triggerToast('Deal updated.');
        setEditingDeal(null);
      } else {
        const created = await catalogApi.createDeal({ ...payload, status: 'pending' });
        setDeals((prev) => [created, ...prev]);
        triggerToast('New deal launched (Pending admin verification).');
        setIsAdding(false);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save deal.');
    } finally {
      setSavingDeal(false);
    }
  };

  const isFormActive = isAdding || !!editingDeal;
  const selectedCount = filteredDeals.filter((d) => selectedIds.includes(d.id)).length;

  // ── presentation — exact reference values (isDeals 2957–2979) ──
  const S: Record<string, CSSProperties> = {
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    createBtn: { background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    couponLink: { fontSize: '11.5px', fontWeight: 800, color: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, cursor: 'pointer' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    statNum: { fontSize: 22, fontWeight: 800, color: '#111827' },
    statLabel: { fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginTop: 4 },
    controls: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 },
    search: { height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 14px 0 34px', fontSize: '12.5px', minWidth: 240, outline: 'none', background: '#fff' },
    select: { height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: 12, color: '#111827', background: '#fff', outline: 'none', cursor: 'pointer' },
    bulkBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg,rgba(0,4,53,0.94) 0%,rgba(0,6,46,0.92) 80%,rgba(0,2,37,0.94) 100%)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
    bulkChip: { background: ACCENT_WASH, color: ACCENT, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 },
    bulkBtn: { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, padding: '5px 12px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' },
    bulkClear: { cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'none', border: 0 },
    tableWrap: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '10.5px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
    td: { padding: '14px 16px', fontSize: 13, color: '#111827', verticalAlign: 'middle' },
    tdMuted: { padding: '14px 16px', fontSize: 13, color: '#6B7280', verticalAlign: 'middle' },
    row: { borderTop: '1px solid #F1F3F5' },
    discountPill: { background: ACCENT, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' },
    iconBtn: { width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #E8EDF2', background: '#fff', cursor: 'pointer', color: '#6B7280' },
    formCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: 20 },
    fLabel: { fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 6, display: 'block' },
    input: { width: '100%', boxSizing: 'border-box', height: 40, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: '12.5px', outline: 'none', background: '#fff' },
    saveBtn: { background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    ghost: { fontSize: 11, fontWeight: 700, color: '#6B7280', background: 'none', border: 0, cursor: 'pointer', padding: 0 },
  };

  const CATEGORY_OPTIONS = ['Electronics', 'Fashion', 'Home & Living', 'Groceries', 'Beauty', 'Sports & Outdoor', 'Baby & Kids', 'Mobile & Gadgets', ...uniqueCategories]
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div style={{ color: '#111827' }}>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
              background: toast.type === 'error' ? '#DC2626' : '#111827', color: '#fff',
              borderRadius: 12, padding: '11px 18px', fontSize: 12.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            }}
          >
            {toast.type === 'error' ? <AlertTriangle size={15} /> : <Save size={15} />} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header (reference) ── */}
      <div style={S.headRow}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={S.h1}>Deals &amp; Promotions</span>
          <button onClick={() => navigate('/admin/coupons')} style={S.couponLink}>
            Promo Codes &amp; Vouchers <ExternalLink size={12} />
          </button>
        </div>
        <button onClick={() => { setEditingDeal(null); setIsAdding(true); }} style={S.createBtn}>
          <Plus size={14} /> Create Deal
        </button>
      </div>

      {/* ── Real deals-derived metrics ── */}
      <div style={S.statGrid}>
        {([
          ['Total Deals', computedStats.total, '#6C4CFF'],
          ['Live Deals', computedStats.live, '#16A34A'],
          ['Pending Approval', computedStats.pending, '#B45309'],
          ['Expiring 48h', computedStats.expiring48h, '#DC2626'],
        ] as const).map(([label, val, c]) => (
          <div key={label} style={{ ...S.statCard, borderLeft: `4px solid ${c}` }}>
            <div style={S.statNum}>{dealsLoading ? '—' : val}</div>
            <div style={S.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Controls (real search + filters) ── */}
      <div style={S.controls}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }} />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search deals by name or seller…" style={S.search} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={S.select}>
          {['All', 'Live', 'Pending', 'Expiring', 'Expired', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={S.select}>
          <option value="All">All categories</option>
          {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(statusFilter !== 'All' || categoryFilter !== 'All' || searchTerm) && (
          <button onClick={() => { setStatusFilter('All'); setCategoryFilter('All'); setSearchTerm(''); }} style={S.ghost}>Reset</button>
        )}
      </div>

      {/* ── Bulk bar (real) ── */}
      {selectedCount > 0 && (
        <div style={S.bulkBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={S.bulkChip}>{selectedCount} selected</span>
            <button onClick={handleBulkApprove} disabled={bulkActionPending} style={S.bulkBtn}>Approve pending</button>
            <button onClick={handleBulkDelete} disabled={bulkActionPending} style={{ ...S.bulkBtn, background: 'rgba(239,68,68,0.25)' }}>Delete</button>
          </div>
          <button onClick={() => setSelectedIds([])} style={S.bulkClear}>✕ Clear</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isFormActive ? 'minmax(0,1fr) minmax(0,340px)' : 'minmax(0,1fr)', gap: 20, alignItems: 'start' }} className="deals-grid">
        {/* ── Table (reference) ── */}
        <div style={S.tableWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ ...S.th, width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} aria-label="Select all deals" />
                  </th>
                  <th style={S.th}>Deal</th>
                  <th style={S.th}>Brand</th>
                  <th style={S.th}>Discount</th>
                  <th style={S.th}>Starts</th>
                  <th style={S.th}>Ends</th>
                  <th style={S.th}>Clicks</th>
                  <th style={S.th}>Status</th>
                  <th style={{ ...S.th, width: 120, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dealsLoading ? (
                  <tr><td colSpan={9} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 0' }}>
                    <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} /> Loading deals…
                  </td></tr>
                ) : dealsError ? (
                  <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: '32px 16px' }}>
                    <div style={{ color: '#DC2626', fontWeight: 600, fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <AlertTriangle size={15} /> {dealsError}
                    </div>
                    <button onClick={() => void loadDeals()} style={{ ...S.iconBtn, width: 'auto', padding: '6px 12px', fontSize: 11, fontWeight: 800 }}>Retry</button>
                  </td></tr>
                ) : filteredDeals.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 16px', fontStyle: 'italic' }}>
                    No matching deals currently listed.
                  </td></tr>
                ) : (
                  filteredDeals.map((deal) => {
                    const cs = getComputedStatus(deal);
                    const isExpiring = cs === 'expiring';
                    const rowPending = actionPendingId === deal.id;
                    return (
                      <tr key={deal.id} style={{ ...S.row, opacity: rowPending ? 0.6 : 1 }}>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedIds.includes(deal.id)} onChange={() => toggleSelect(deal.id)} aria-label={`Select ${deal.name}`} />
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.name}</td>
                        <td style={S.tdMuted}>{deal.seller}</td>
                        <td style={S.td}>
                          <span style={S.discountPill}>
                            {deal.discountType === 'flat' ? `৳${deal.discountValue} OFF` : `${deal.discountValue}% OFF`}
                          </span>
                        </td>
                        <td style={S.tdMuted}>{fmtDate(deal.validFrom)}</td>
                        <td style={{ ...S.tdMuted, color: isExpiring ? '#DC2626' : '#6B7280' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {isExpiring && <Clock size={13} />} {getExpiryDisplay(deal.validUntil)}
                          </span>
                        </td>
                        <td style={S.tdMuted}>{deal.clicks ? deal.clicks.toLocaleString() : '—'}</td>
                        <td style={S.td}><span style={statusBadge(cs)}>{capitalize(cs)}</span></td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            {cs === 'pending' ? (
                              <>
                                <button onClick={() => handleApprove(deal.id)} disabled={rowPending} title="Approve / publish live" style={{ ...S.iconBtn, color: '#16A34A', borderColor: '#BBF7D0' }}><CheckCircle size={14} /></button>
                                <button onClick={() => handleReject(deal.id)} disabled={rowPending} title="Reject request" style={{ ...S.iconBtn, color: '#DC2626', borderColor: '#FECACA' }}><XCircle size={14} /></button>
                              </>
                            ) : (cs === 'live' || cs === 'expiring') ? (
                              <button onClick={() => handlePause(deal.id)} disabled={rowPending} title="Pause / end deal" style={{ ...S.iconBtn, color: '#B45309', borderColor: '#FDE68A' }}><Pause size={14} /></button>
                            ) : null}
                            <button onClick={() => { setIsAdding(false); setEditingDeal(deal); }} disabled={rowPending} title="Edit deal" style={{ ...S.iconBtn, color: '#2563EB', borderColor: '#BFDBFE' }}><Edit3 size={14} /></button>
                            <button onClick={() => setConfirmingId(deal.id)} disabled={rowPending} title="Remove deal" style={{ ...S.iconBtn, color: '#DC2626', borderColor: '#FECACA' }}><Trash2 size={14} /></button>
                          </div>
                          {confirmingId === deal.id && (
                            <div style={{ marginTop: 6, padding: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: '#DC2626' }}>Delete this deal?</span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { void handleDelete(deal.id); setConfirmingId(null); }} style={{ padding: '4px 8px', background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', borderRadius: 5, border: 0, cursor: 'pointer' }}>Confirm</button>
                                <button onClick={() => setConfirmingId(null)} style={{ padding: '4px 8px', background: '#fff', border: '1px solid #E8EDF2', color: '#6B7280', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', borderRadius: 5, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Add / Edit Deal — integrated into the same visual system ── */}
        <AnimatePresence mode="wait">
          {isFormActive && (
            <motion.div
              key={editingDeal ? 'edit' : 'add'}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              style={{ ...S.formCard, position: 'sticky', top: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F3F5', paddingBottom: 12, marginBottom: 14 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {editingDeal ? 'Modify Deal' : 'Publish New Deal'}
                </span>
                <button type="button" onClick={() => { setIsAdding(false); setEditingDeal(null); }} style={S.ghost}>Close</button>
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.fLabel}>DEAL NAME</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Eid Mega Sale" style={S.input} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.fLabel}>BRAND / SELLER</label>
                  <input value={formSeller} onChange={(e) => setFormSeller(e.target.value)} placeholder="e.g. Aarong" style={S.input} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={S.fLabel}>DISCOUNT TYPE</label>
                    <select value={formDiscountType} onChange={(e) => setFormDiscountType(e.target.value as 'percentage' | 'flat')} style={{ ...S.input, fontSize: 12 }}>
                      <option value="percentage">Percentage</option>
                      <option value="flat">Flat (৳)</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>VALUE</label>
                    <input type="number" min={0} value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))} style={S.input} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.fLabel}>CATEGORY</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} style={{ ...S.input, fontSize: 12 }}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.fLabel}>VALID UNTIL</label>
                  <input type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} style={{ ...S.input, fontSize: 12 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={S.fLabel}>PROMO CODE <span style={{ color: '#9CA3AF', fontWeight: 600 }}>(optional)</span></label>
                  <input value={formPromoCode} onChange={(e) => setFormPromoCode(e.target.value)} placeholder="e.g. EID2026" style={S.input} />
                </div>
                {formError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11.5, fontWeight: 600, color: '#B91C1C' }}>{formError}</div>
                )}
                <button type="submit" disabled={savingDeal} style={{ ...S.saveBtn, width: '100%', justifyContent: 'center', opacity: savingDeal ? 0.6 : 1 }}>
                  <Save size={14} /> {savingDeal ? 'SAVING…' : editingDeal ? 'SAVE CHANGES' : 'PUBLISH DEAL'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`@media (max-width: 980px){ .deals-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
