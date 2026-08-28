import React, { useMemo, useState, CSSProperties } from 'react';
import { Search, Plus, AlertTriangle, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogProduct, CatalogInventory } from '../../types/catalog';

/**
 * Products & Inventory (Sprint 13 UI restoration).
 *
 * PRESENTATION is a faithful reproduction of the approved standalone
 * `isProductsPage` + `isProducts` + `isLowStockView` sections
 * (design-reference/Choosify Admin CMS (standalone).html, decoded 384–563 /
 * 5977–6014): exact hex, px, grid and DOM structure, inline styles. Sanctioned
 * deviation: accent = var(--cms-accent), not the raw reference #FF5B00.
 *
 * Behavioural contract — DO NOT regress (from a2d6b33, 39/39 ownership probe):
 *  - Product list / mutations go through the canonical catalog API
 *    (GET|PATCH|DELETE /api/v1/catalog/products*). Seller ownership is enforced
 *    SERVER-SIDE by scopeProductsForRequest / userCanMutateOwnedProduct; the
 *    brand dropdown is a presentational filter within the already-scoped set,
 *    never the security boundary.
 *  - Canonical inventory model is owned by the server. The only write this
 *    screen makes to inventory is an explicit, user-initiated "⚡ RE-STOCK (+5)"
 *    that calls the canonical ownership-checked adjustProductInventory({ delta })
 *    endpoint (the same one the editor uses). It never reserves/releases/
 *    consumes stock and never fabricates history. All other inventory edits
 *    still happen in the editor (/admin/products/:id/edit).
 *  - Product creation only via /admin/products/new.
 *  - No persisted inventory audit / stock-movement / alert store exists, so the
 *    Audit tab is honestly disabled and Stock Attention shows only current,
 *    server-derived conditions (no timestamps, ids, acknowledgement, history).
 *
 * The approved layout keeps the standalone's structure but every section the
 * prototype fills with mock data renders an HONEST empty/disabled state instead:
 *  - the 3 analytics cards (Popularity Insights / Top Performing Categories /
 *    Conversion & Engagement) have no persisted analytics source, so they show
 *    their card + an honest "not available" body — never the prototype's
 *    8.24% / 41.5% / sparkline values.
 *  - the row "stock ON/OFF" toggle: the prototype's `stockActive` flag has no
 *    canonical field. It is wired to the real publish status instead —
 *    ON = status 'live', OFF = status 'draft' — through the same
 *    ownership-checked catalogApi.updateProduct the bulk bar uses. It never
 *    mutates inventory quantity.
 *  - not reproduced at all: "· N views", "Est. Commission", partial-payment
 *    label, ⚡ RE-STOCK, FEATURE request, expand-row AUDIT HISTORY, the
 *    ALL/WARNING/CRITICAL alert filter, ✉ EMAIL / ⚙ SLACK checkboxes and the
 *    alert Timestamp / SKU / Severity / ACKNOWLEDGE columns.
 */

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  brandId: string;
  category: string;
  price: string;
  priceValue: number;
  status: string;
  productReferenceId?: string;
  sku?: string;
  stock: number;
  sellerId?: string;
};

type AttentionState = 'low_stock' | 'out_of_stock';
type AttentionRow = {
  productId: string;
  name: string;
  brand: string;
  availableQuantity: number | null;
  lowStockThreshold: number | null;
  state: AttentionState;
};
type PageTab = 'catalog' | 'attention' | 'audit';
type SortKey = 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_asc';

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name_asc', label: 'Name: A → Z' },
  { key: 'name_desc', label: 'Name: Z → A' },
  { key: 'price_asc', label: 'Price: Low → High' },
  { key: 'price_desc', label: 'Price: High → Low' },
  { key: 'stock_asc', label: 'Stock: Low → High' },
];

const mapCatalogProduct = (product: CatalogProduct): ProductRow => ({
  id: product.id,
  name: product.title,
  brand: product.brandName,
  brandId: product.brandId,
  category: product.categoryName,
  priceValue: Number(product.price || 0),
  price: `৳ ${Number(product.price || 0).toLocaleString()}`,
  status: product.status === 'live' ? 'Active' : product.status === 'draft' ? 'Draft' : 'Archived',
  productReferenceId: product.productReferenceId,
  sku: product.sku,
  stock: Math.max(0, typeof product.stock === 'number' ? product.stock : 0),
  sellerId: product.sellerId,
});

const statusPill = (status: string): CSSProperties => {
  const map: Record<string, { bg: string; fg: string }> = {
    Active: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
    Draft: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
    Archived: { bg: '#F1F3F5', fg: '#6B7280' },
    'Out of Stock': { bg: 'rgba(239,68,68,0.1)', fg: '#DC2626' },
  };
  const c = map[status] || { bg: '#F1F3F5', fg: '#6B7280' };
  return { background: c.bg, color: c.fg, fontSize: 9, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' };
};

export default function ProductsPage() {
  const { profile, activeBrandId, allBrands, sellerBrands } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(activeBrandId);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as PageTab) || 'catalog';
  const setActiveTab = (tab: PageTab) => {
    const params = new URLSearchParams(location.search);
    if (tab === 'catalog') params.delete('tab');
    else params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const [attentionRows, setAttentionRows] = useState<AttentionRow[]>([]);
  const [attentionLoading, setAttentionLoading] = useState(false);
  const [attentionLoaded, setAttentionLoaded] = useState(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const isSeller = profile?.role === 'seller';
  const sellerRelations = sellerBrands.filter((r) => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map((r) => r.brand_id);
  // Server: DELETE /catalog/products/:id needs PRODUCT_DELETE, which the plain
  // `seller` role does not hold (only verified_seller / admin / super_admin —
  // server/permissions/permissions.ts). Don't surface a Delete control that
  // would 403; create / edit / inventory are available to a plain seller.
  const canDeleteProducts = ['verified_seller', 'admin', 'super_admin'].includes(profile?.role ?? '');

  // ----- Load products from the canonical, server-scoped catalog API -----
  React.useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setCatalogError(null);
      try {
        const params = selectedBrandFilter ? { brandId: selectedBrandFilter } : undefined;
        const catalogProducts = await catalogApi.listProducts(params);
        if (cancelled) return;
        setProducts(catalogProducts.map(mapCatalogProduct));
      } catch (err) {
        if (cancelled) return;
        setProducts([]);
        setCatalogError(err instanceof Error ? err.message : 'Failed to load catalog products.');
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    };
    loadProducts();
    return () => { cancelled = true; };
  }, [selectedBrandFilter, profile?.id]);

  React.useEffect(() => { setSelectedBrandFilter(activeBrandId); }, [activeBrandId]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products],
  );

  const displayedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchesSearch = !q
        || p.name.toLowerCase().includes(q)
        || p.brand.toLowerCase().includes(q)
        || (p.sku ? p.sku.toLowerCase().includes(q) : false)
        || (p.productReferenceId ? p.productReferenceId.toLowerCase().includes(q) : false);
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'price_asc': return a.priceValue - b.priceValue;
        case 'price_desc': return b.priceValue - a.priceValue;
        case 'stock_asc': return a.stock - b.stock;
        case 'name_asc':
        default: return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [products, search, categoryFilter, statusFilter, sortKey]);

  // ----- Inventory conditions: hydrated once per loaded catalog set, from the
  // canonical ownership-checked read endpoint. Feeds both the "LOW STOCK SKUS"
  // KPI and the Stock Attention tab. Read-only; no persistence, no fabrication.
  React.useEffect(() => {
    if (attentionLoaded || isLoadingProducts || products.length === 0) return;
    let cancelled = false;
    const hydrate = async () => {
      setAttentionLoading(true);
      setAttentionError(null);
      const targets = products;
      try {
        const results = await Promise.allSettled(targets.map((p) => catalogApi.getProductInventory(p.id)));
        if (cancelled) return;
        const rows: AttentionRow[] = [];
        results.forEach((res, i) => {
          const product = targets[i];
          if (res.status === 'fulfilled') {
            const inv: CatalogInventory = res.value.data;
            if (inv.inventoryState === 'out_of_stock' || inv.inventoryState === 'low_stock') {
              rows.push({
                productId: product.id, name: product.name, brand: product.brand,
                availableQuantity: inv.availableQuantity, lowStockThreshold: inv.lowStockThreshold,
                state: inv.inventoryState,
              });
            }
          } else if (product.stock === 0) {
            rows.push({ productId: product.id, name: product.name, brand: product.brand, availableQuantity: 0, lowStockThreshold: null, state: 'out_of_stock' });
          }
        });
        rows.sort((a, b) => {
          if (a.state !== b.state) return a.state === 'out_of_stock' ? -1 : 1;
          return (a.availableQuantity ?? 0) - (b.availableQuantity ?? 0);
        });
        setAttentionRows(rows);
        setAttentionLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setAttentionError(err instanceof Error ? err.message : 'Failed to load current stock conditions.');
      } finally {
        if (!cancelled) setAttentionLoading(false);
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, [attentionLoaded, isLoadingProducts, products]);

  React.useEffect(() => { setAttentionLoaded(false); setAttentionRows([]); }, [selectedBrandFilter, profile?.id]);

  const attentionByProduct = useMemo(() => {
    const m: Record<string, AttentionRow> = {};
    attentionRows.forEach((r) => { m[r.productId] = r; });
    return m;
  }, [attentionRows]);

  // ----- Bulk catalog mutations (canonical API) -----
  const runBulk = async (
    label: string,
    fn: (id: string) => Promise<unknown>,
    apply: (prev: ProductRow[]) => ProductRow[],
  ) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map(fn));
      setProducts(apply);
      showToast(`${label} ${ids.length} product${ids.length === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : `${label} failed`, 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };
  const handleBulkApprove = () => runBulk('Approved', (id) => catalogApi.updateProduct(id, { status: 'live' }), (prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Active' } : p)));
  const handleBulkReject = () => runBulk('Archived', (id) => catalogApi.updateProduct(id, { status: 'archived' }), (prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Archived' } : p)));
  const handleBulkDelete = () => runBulk('Deleted', (id) => catalogApi.deleteProduct(id), (prev) => prev.filter((p) => !selectedIds.has(p.id)));

  // Row "stock ON/OFF" toggle — no canonical stock-active flag exists, so this
  // drives the real publish status (live ↔ draft) via the ownership-checked
  // catalogApi.updateProduct. It never touches inventory quantity.
  const handleTogglePublish = async (p: ProductRow) => {
    const next = p.status === 'Active' ? 'draft' : 'live';
    setTogglingId(p.id);
    try {
      await catalogApi.updateProduct(p.id, { status: next });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next === 'live' ? 'Active' : 'Draft' } : x)));
      showToast(next === 'live' ? 'Listing published' : 'Listing unpublished');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update listing status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setDeletingId(id);
    try {
      await catalogApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      showToast('Product deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // "⚡ RE-STOCK (+5)" — a real, explicit, user-initiated inventory adjustment
  // through the canonical ownership-checked endpoint (PATCH inventory { delta }).
  // Not an alert acknowledgement (there is no persisted alert store); it simply
  // adds 5 units, then reconciles the affected rows from the server response.
  const RESTOCK_STEP = 5;
  const handleQuickRestock = async (productId: string) => {
    setRestockingId(productId);
    try {
      const res = await catalogApi.adjustProductInventory(productId, { delta: RESTOCK_STEP });
      const inv = res.data;
      const available = typeof inv.availableQuantity === 'number' ? inv.availableQuantity : inv.quantity - inv.reservedQuantity;
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, available) } : p)));
      setAttentionRows((prev) => {
        const stillFlagged = inv.inventoryState === 'low_stock' || inv.inventoryState === 'out_of_stock';
        if (!stillFlagged) return prev.filter((r) => r.productId !== productId);
        return prev.map((r) => (r.productId === productId
          ? { ...r, availableQuantity: inv.availableQuantity, lowStockThreshold: inv.lowStockThreshold, state: inv.inventoryState as AttentionState }
          : r));
      });
      showToast(`Restocked +${RESTOCK_STEP} units`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Restock failed', 'error');
    } finally {
      setRestockingId(null);
    }
  };

  const handleExportProductsCSV = () => {
    const rows = displayedProducts.filter((p) => selectedIds.has(p.id));
    if (!rows.length) return;
    const header = 'ID,Product Name,Brand,Category,Price,Status,Stock';
    const body = rows
      .map((p) => `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand.replace(/"/g, '""')}","${p.category}","${p.price}","${p.status}","${p.stock}"`)
      .join('\n');
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + header + '\n' + body);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${rows.length} product${rows.length === 1 ? '' : 's'} to CSV`);
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = displayedProducts.length > 0 && displayedProducts.every((p) => selectedIds.has(p.id));
  const toggleSelectAll = () => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (allSelected) displayedProducts.forEach((p) => next.delete(p.id));
    else displayedProducts.forEach((p) => next.add(p.id));
    return next;
  });

  // ----- KPI strip — every value derived from loaded canonical data only -----
  const combinedProductStats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.status === 'Active').length;
    const pending = products.filter((p) => p.status === 'Draft').length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    const lowStock = attentionRows.filter((r) => r.state === 'low_stock').length;
    const activePct = total ? Math.round((active / total) * 100) : 0;
    return [
      { label: 'Total Products', value: total, sub: 'Full catalog', barColor: '#3B82F6' },
      { label: 'Active Products', value: active, sub: `${activePct}% of catalog`, barColor: '#16A34A' },
      { label: 'Low Stock SKUs', value: attentionLoaded ? lowStock : '—', sub: 'Needs replenishment', barColor: '#F59E0B' },
      { label: 'Out Of Stock', value: outOfStock, sub: 'Disrupting checkouts', barColor: '#DC2626' },
      { label: 'Pending Approval', value: pending, sub: 'Awaiting review', barColor: 'var(--cms-accent)' },
    ];
  }, [products, attentionRows, attentionLoaded]);

  const attentionSummary = useMemo(() => ({
    out: attentionRows.filter((r) => r.state === 'out_of_stock').length,
    low: attentionRows.filter((r) => r.state === 'low_stock').length,
  }), [attentionRows]);

  const brandFilterVisible = isSeller && allBrands.filter((b) => ownedBrandIds.includes(b.id)).length > 1;
  const selectedCount = displayedProducts.filter((p) => selectedIds.has(p.id)).length;

  // ── presentation — exact reference values ──
  const S: Record<string, CSSProperties> = {
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 18, fontWeight: 800, color: '#111827' },
    sub: { fontSize: 12, color: '#374151', marginTop: 2 },
    addBtn: { background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,minmax(150px,1fr))', gap: 14, marginBottom: 18 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 5, padding: 16 },
    statNum: { fontSize: 22, fontWeight: 800, color: '#111827' },
    statLabel: { fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 },
    statSub: { fontSize: '9.5px', fontWeight: 600, color: ACCENT, marginTop: 6 },
    analyticsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(220px,1fr))', gap: 16, marginBottom: 18 },
    glassCard: { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 8px 20px rgba(17,24,39,0.08)', borderRadius: 16, padding: 18 },
    glassTitle: { fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
    glassEmpty: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.5 },
    tabBar: { display: 'flex', gap: 6, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: 8, marginBottom: 12, overflowX: 'auto' },
    tab: { padding: '9px 16px', borderRadius: 8, fontSize: '11.5px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', color: '#374151' },
    tabActive: { background: ACCENT, color: '#fff' },
    filterRow: { display: 'flex', gap: 10, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 5, padding: 10, marginBottom: 12, flexWrap: 'wrap' },
    search: { flex: 1, minWidth: 220, height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 14px 0 36px', fontSize: '12.5px', outline: 'none', background: '#fff' },
    select: { height: 38, boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: 12, color: '#111827', background: '#fff', outline: 'none', cursor: 'pointer' },
    bulkBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg,rgba(0,4,53,0.94) 0%,rgba(0,6,46,0.92) 80%,rgba(0,2,37,0.94) 100%)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
    bulkChip: { background: ACCENT_WASH, color: ACCENT, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 },
    bClear: { cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'none', border: 0 },
    tableWrap: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, overflowX: 'auto' },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '10.5px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
    td: { padding: '14px 16px', fontSize: 13, color: '#111827', verticalAlign: 'middle' },
    tdMuted: { padding: '14px 16px', fontSize: 13, color: '#6B7280', verticalAlign: 'middle' },
    row: { borderTop: '1px solid #F1F3F5' },
    thumb: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#F1F3F5', color: '#6B7280', fontWeight: 800, fontSize: 15 },
    catPill: { fontSize: 10, fontWeight: 700, color: '#374151', background: '#F1F3F5', padding: '4px 10px', borderRadius: 6, textTransform: 'uppercase', whiteSpace: 'nowrap' },
    actionCol: { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
    actionCap: { fontSize: 8, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: '14px 16px' },
  };

  const bulkBtn = (bg: string): CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' });
  const actionWord = (color: string): CSSProperties => ({ fontSize: 12, fontWeight: 700, color, cursor: 'pointer', background: 'none', border: 0, padding: 0, textDecoration: 'none', whiteSpace: 'nowrap' });
  const restockBtn: CSSProperties = { background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 11px', fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em' };

  // Reference "stock ON/OFF" switch — bound to publish status (see handleTogglePublish).
  const publishToggle = (p: ProductRow) => {
    const on = p.status === 'Active';
    const busy = togglingId === p.id;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
        <span
          role="switch"
          aria-checked={on}
          aria-label={`${on ? 'Unpublish' : 'Publish'} ${p.name}`}
          onClick={() => !busy && handleTogglePublish(p)}
          style={{ width: 30, height: 16, borderRadius: 999, position: 'relative', cursor: busy ? 'wait' : 'pointer', background: on ? '#16A34A' : '#E5E7EB', opacity: busy ? 0.6 : 1, transition: 'background 0.15s', flexShrink: 0, display: 'inline-block' }}
        >
          <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
        </span>
        <span style={{ fontSize: '8.5px', fontWeight: 800, color: '#9CA3AF' }}>{on ? 'ON' : 'OFF'}</span>
      </div>
    );
  };

  const TABS: { key: PageTab; label: string }[] = [
    { key: 'catalog', label: 'Product Catalog' },
    { key: 'attention', label: 'Low Stock Alerts' },
    { key: 'audit', label: 'Audit & Reconciliation' },
  ];

  const analyticsCards = [
    { title: 'Popularity Insights', body: 'Product view, search and save analytics are not available in this release — there is no persisted analytics store to source most-viewed / most-searched / most-saved from.' },
    { title: 'Top Performing Categories', body: 'Category revenue and share analytics are not available in this release.' },
    { title: 'Conversion & Engagement', body: 'Detail-to-cart, cart-to-checkout and net conversion trend analytics are not available in this release.' },
  ];

  return (
    <div style={{ color: '#111827' }}>
      {/* ── Header (isProductsPage) ── */}
      <div style={S.headRow}>
        <div>
          <div style={S.h1}>Inventory Management</div>
          <div style={S.sub}>Manage platform catalog, pricing, stock levels and seller listings — all in one place</div>
        </div>
        <button onClick={() => navigate('/admin/products/new')} style={S.addBtn}><Plus size={14} /> Add Product</button>
      </div>

      {/* ── 5-up KPI strip (isProductsPage / combinedProductStats) ── */}
      <div style={S.statGrid}>
        {combinedProductStats.map((s) => (
          <div key={s.label} style={{ ...S.statCard, borderLeft: `4px solid ${s.barColor}` }}>
            <div style={S.statNum}>{isLoadingProducts ? '—' : s.value}</div>
            <div style={S.statLabel}>{s.label}</div>
            <div style={S.statSub}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 3 analytics cards — structure retained, honest empty states ── */}
      <div style={S.analyticsGrid}>
        {analyticsCards.map((c) => (
          <div key={c.title} style={S.glassCard}>
            <div style={S.glassTitle}>{c.title}</div>
            <div style={S.glassEmpty}>{c.body}</div>
          </div>
        ))}
      </div>

      {/* ── Tab bar (isProducts / unifiedProductTabs) ── */}
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <div key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── CATALOG ── */}
      {activeTab === 'catalog' && (
        <>
          <div style={S.filterRow}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, brands, SKU or reference id…" style={S.search} />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={S.select}>
              <option value="All">All Categories</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={S.select}>
              {['All', 'Active', 'Draft', 'Archived'].map((s) => <option key={s} value={s}>{s === 'All' ? 'Status: Any' : s}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={S.select}>
              {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {brandFilterVisible && (
              <select value={selectedBrandFilter || ''} onChange={(e) => setSelectedBrandFilter(e.target.value || null)} style={S.select}>
                <option value="">All my brands</option>
                {allBrands.filter((b) => ownedBrandIds.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          {selectedCount > 0 && (
            <div style={S.bulkBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={S.bulkChip}>{selectedCount} selected</span>
                <button onClick={handleBulkApprove} disabled={bulkActionLoading} style={bulkBtn('#16A34A')}>Approve All</button>
                <button onClick={handleBulkReject} disabled={bulkActionLoading} style={bulkBtn('#B45309')}>Reject All</button>
                {canDeleteProducts && (
                  <button onClick={handleBulkDelete} disabled={bulkActionLoading} style={bulkBtn('#DC2626')}>Delete All</button>
                )}
                <button onClick={handleExportProductsCSV} disabled={bulkActionLoading} style={bulkBtn('#4338CA')}>Export CSV</button>
              </div>
              <button onClick={() => setSelectedIds(new Set())} style={S.bClear}>✕ Clear</button>
            </div>
          )}

          <div style={S.tableWrap}>
            <table style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ ...S.th, width: 40, textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all products" />
                  </th>
                  <th style={{ ...S.th, width: 40 }}>Sl.</th>
                  <th style={S.th}>Product Details</th>
                  <th style={S.th}>Category</th>
                  <th style={S.th}>Stock</th>
                  <th style={S.th}>Price</th>
                  <th style={S.th}>Status</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingProducts ? (
                  <tr><td colSpan={8} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 0' }}>Loading catalog products…</td></tr>
                ) : catalogError ? (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: '32px 16px', color: '#DC2626', fontWeight: 600 }}>
                    <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                    Could not load catalog products: {catalogError.slice(0, 200)}
                  </td></tr>
                ) : displayedProducts.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...S.tdMuted, textAlign: 'center', padding: '40px 16px', fontStyle: 'italic' }}>
                    No products yet. Create one from Add Product.
                  </td></tr>
                ) : (
                  displayedProducts.map((p, idx) => {
                    const att = attentionByProduct[p.id];
                    const stockColor = p.stock === 0 ? '#DC2626' : att?.state === 'low_stock' ? '#B45309' : '#111827';
                    const displayStatus = p.stock === 0 ? 'Out of Stock' : p.status;
                    return (
                      <tr key={p.id} style={S.row}>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.name}`} />
                        </td>
                        <td style={S.tdMuted}>{idx + 1}</td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={S.thumb}>{(p.name || '?').charAt(0).toUpperCase()}</span>
                            <div style={{ minWidth: 0 }}>
                              <Link to={`/admin/products/${p.id}/edit`} style={{ fontWeight: 700, color: '#111827', textDecoration: 'none' }}>{p.name}</Link>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.brand}</span>
                                {p.productReferenceId ? <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#9CA3AF' }}>· {p.productReferenceId}</span> : null}
                                {p.sku ? <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>· SKU {p.sku}</span> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={S.td}><span style={S.catPill}>{p.category || '—'}</span></td>
                        <td style={S.td}>
                          <span style={{ fontWeight: 800, color: stockColor }}>{p.stock} units</span>
                          {p.stock === 0
                            ? <div style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, marginTop: 2 }}>⚠ Out of stock</div>
                            : att?.state === 'low_stock'
                              ? <div style={{ fontSize: 9, color: '#B45309', fontWeight: 700, marginTop: 2 }}>⚠ Low stock</div>
                              : null}
                          {publishToggle(p)}
                        </td>
                        <td style={S.td}><span style={{ fontWeight: 800 }}>{p.price}</span></td>
                        <td style={S.td}><span style={statusPill(displayStatus)}>{displayStatus}</span></td>
                        <td style={{ ...S.td, textAlign: 'right' }}>
                          {confirmDeleteId === p.id ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>Delete?</span>
                              <button onClick={() => handleDeleteProduct(p.id)} disabled={deletingId === p.id} style={{ ...bulkBtn('#DC2626'), padding: '5px 10px' }}>
                                {deletingId === p.id ? '…' : 'Yes'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ ...actionWord('#6B7280'), fontSize: 11 }}>No</button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 16 }}>
                              {(p.stock === 0 || att?.state === 'low_stock') && (
                                <button onClick={() => handleQuickRestock(p.id)} disabled={restockingId === p.id} style={{ ...restockBtn, alignSelf: 'center' }}>
                                  {restockingId === p.id ? '…' : `⚡ RE-STOCK (+${RESTOCK_STEP})`}
                                </button>
                              )}
                              <span style={S.actionCol}>
                                <span style={S.actionCap}>STOCK</span>
                                <Link to={`/admin/products/${p.id}/edit`} style={actionWord('#2563EB')}>Adjust Stock</Link>
                              </span>
                              <span style={S.actionCol}>
                                <span style={S.actionCap}>EDIT</span>
                                <Link to={`/admin/products/${p.id}/edit`} style={actionWord('#374151')}>Edit</Link>
                              </span>
                              {canDeleteProducts && (
                                <span style={S.actionCol}>
                                  <span style={S.actionCap}>DELETE</span>
                                  <button onClick={() => setConfirmDeleteId(p.id)} style={actionWord('#DC2626')}>Delete</button>
                                </span>
                              )}
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
        </>
      )}

      {/* ── LOW STOCK ALERTS (isLowStockView) ── */}
      {activeTab === 'attention' && (
        <>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Low Stock Alerts</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 14 }}>
            Products at or below their low-stock threshold, derived from current canonical inventory. These are live conditions,
            not persisted alerts — there is no history, acknowledgement or notification here. Quick-restock adds{' '}
            +{RESTOCK_STEP} units through the canonical inventory endpoint; use a product&apos;s editor for any other adjustment.
          </div>

          {attentionLoaded && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <span style={{ ...statusPill('Out of Stock'), padding: '4px 10px', fontSize: 10 }}>{attentionSummary.out} out of stock</span>
              <span style={{ ...statusPill('Draft'), padding: '4px 10px', fontSize: 10 }}>{attentionSummary.low} low stock</span>
            </div>
          )}

          {attentionError ? (
            <div style={{ ...S.panel, color: '#DC2626', fontWeight: 600 }}>{attentionError}</div>
          ) : attentionLoading ? (
            <div style={{ ...S.panel, textAlign: 'center', color: '#6B7280' }}>Checking current stock levels…</div>
          ) : attentionRows.length === 0 ? (
            <div style={{ ...S.panel, textAlign: 'center', padding: '40px 16px' }}>
              <CheckCircle size={36} color="#16A34A" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 15, fontWeight: 800 }}>No stock needs attention</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Every tracked product is currently above its low-stock threshold.</div>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB' }}>
                    <th style={S.th}>Product</th>
                    <th style={S.th}>Available</th>
                    <th style={S.th}>Low-stock threshold</th>
                    <th style={S.th}>Current condition</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionRows.map((r) => (
                    <tr key={r.productId} style={S.row}>
                      <td style={S.td}>
                        <Link to={`/admin/products/${r.productId}/edit`} style={{ fontWeight: 700, color: '#111827', textDecoration: 'none' }}>{r.name}</Link>
                        <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.brand}</div>
                      </td>
                      <td style={S.td}><span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{r.availableQuantity ?? '—'}</span></td>
                      <td style={S.tdMuted}><span style={{ fontFamily: 'monospace' }}>{r.lowStockThreshold ?? '—'}</span></td>
                      <td style={S.td}><span style={statusPill(r.state === 'out_of_stock' ? 'Out of Stock' : 'Draft')}>{r.state.replace(/_/g, ' ')}</span></td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => handleQuickRestock(r.productId)} disabled={restockingId === r.productId} style={restockBtn}>
                            {restockingId === r.productId ? '…' : `⚡ RE-STOCK (+${RESTOCK_STEP})`}
                          </button>
                          <Link to={`/admin/products/${r.productId}/edit`} style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: ACCENT, textDecoration: 'none', border: `1px solid ${ACCENT}`, borderRadius: 6, padding: '5px 10px', background: ACCENT_WASH }}>Manage stock</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── AUDIT — honestly disabled (no persisted store) ── */}
      {activeTab === 'audit' && (
        <div style={{ ...S.panel, textAlign: 'center', padding: '48px 16px' }}>
          <FileSpreadsheet size={36} color="#9CA3AF" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>Inventory audit history is not available in this release</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            A persisted stock-movement ledger and physical-variance reconciliation are planned for a future release. Current
            stock is shown live on the Product Catalog and Low Stock Alerts tabs.
          </div>
        </div>
      )}

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
            {toast.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle size={15} />} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
