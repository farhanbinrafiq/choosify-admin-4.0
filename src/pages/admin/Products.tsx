import React, { useMemo, useState } from 'react';
import {
  Search,
  Smartphone,
  Tv,
  Shirt,
  Box,
  Eye,
  CheckCircle,
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  Pencil,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogProduct, CatalogInventory } from '../../types/catalog';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { BulkActionBar, BulkAction } from '../../components/ui/BulkActionBar';
import { Badge } from '../../components/ui/Badge';

/**
 * Products & Inventory (Sprint 13 UI consolidation).
 *
 * Behavioural contract — DO NOT regress:
 *  - Product list / mutations go through the canonical catalog API
 *    (`GET|PUT|PATCH|DELETE /api/v1/catalog/products*`). Seller ownership is
 *    enforced SERVER-SIDE by `scopeProductsForRequest` /
 *    `userCanMutateOwnedProduct` in `server/catalogRouter.ts` — the brand
 *    dropdown below is a presentational filter within the already-scoped set,
 *    never the security boundary.
 *  - Canonical inventory model (quantity / reservedQuantity / availableQuantity
 *    / lowStockThreshold / product.stock) is owned by the server-side
 *    inventory + Operations engines. This screen is READ-ONLY with respect to
 *    inventory lifecycle: it never reserves, releases, consumes, restocks or
 *    otherwise mutates stock. Adjustments happen only in the product editor
 *    (`/admin/products/:id/edit` → PATCH /catalog/products/:id/inventory).
 *  - Product creation happens only via `/admin/products/new`.
 *  - There is no persisted inventory audit / stock-movement / alert store in
 *    the backend today, so the Audit tab is honestly disabled for V1 and the
 *    Stock Attention tab shows only current, server-derived conditions
 *    (no timestamps, ids, acknowledgement or history).
 */

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  brandId: string;
  category: string;
  price: string;
  status: string;
  productReferenceId?: string;
  sku?: string;
  stock: number;
  sellerId?: string;
  icon: typeof Smartphone;
  color: string;
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

const categoryIcon = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('mobile') || normalized.includes('tech')) {
    return { icon: Smartphone, color: 'text-blue-500 bg-blue-500/10' };
  }
  if (normalized.includes('electronic') || normalized.includes('tv')) {
    return { icon: Tv, color: 'text-indigo-500 bg-indigo-500/10' };
  }
  if (normalized.includes('fashion') || normalized.includes('apparel') || normalized.includes('wear')) {
    return { icon: Shirt, color: 'text-purple-500 bg-purple-500/10' };
  }
  return { icon: Box, color: 'text-green-500 bg-green-500/10' };
};

const mapCatalogProduct = (product: CatalogProduct): ProductRow => {
  const { icon, color } = categoryIcon(product.categoryName || '');
  return {
    id: product.id,
    name: product.title,
    brand: product.brandName,
    brandId: product.brandId,
    category: product.categoryName,
    price: `৳ ${Number(product.price || 0).toLocaleString()}`,
    status: product.status === 'live' ? 'Live' : product.status === 'draft' ? 'Pending' : 'Flagged',
    productReferenceId: product.productReferenceId,
    sku: product.sku,
    stock: Math.max(0, typeof product.stock === 'number' ? product.stock : 0),
    sellerId: product.sellerId,
    icon,
    color,
  };
};

const statusBadgeVariant = (status: string) => {
  if (status === 'Live') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
};

export default function ProductsPage() {
  const { profile, activeBrandId, allBrands, sellerBrands } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ----- Catalog state -----
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(activeBrandId);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ----- Tab state (persisted in the URL so it's shareable/deep-linkable) -----
  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as PageTab) || 'catalog';
  const setActiveTab = (tab: PageTab) => {
    const params = new URLSearchParams(location.search);
    if (tab === 'catalog') params.delete('tab');
    else params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  // ----- Stock Attention tab: lazily hydrated, read-only, current-state only -----
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

  // ----- Load products from the canonical catalog API -----
  // Server scopes to the authenticated owner (sellers) or returns the full
  // catalog (platform admin / CMS editors). `brandId` is an additional
  // server-side filter, not an authorization lever.
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
    return () => {
      cancelled = true;
    };
  }, [selectedBrandFilter, profile?.id]);

  React.useEffect(() => {
    setSelectedBrandFilter(activeBrandId);
  }, [activeBrandId]);

  const displayedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.sku ? p.sku.toLowerCase().includes(q) : false) ||
        (p.productReferenceId ? p.productReferenceId.toLowerCase().includes(q) : false),
    );
  }, [products, search]);

  // ----- Stock Attention: hydrate once when the tab is first opened -----
  // Uses the existing canonical, ownership-checked read endpoint
  // (GET /catalog/products/:id/inventory). No new backend, no persistence,
  // no fabricated thresholds. Classification comes straight from the
  // server-computed `inventoryState`.
  React.useEffect(() => {
    if (activeTab !== 'attention' || attentionLoaded || isLoadingProducts) return;
    let cancelled = false;
    const hydrate = async () => {
      setAttentionLoading(true);
      setAttentionError(null);
      const targets = displayedProducts;
      try {
        const results = await Promise.allSettled(
          targets.map((p) => catalogApi.getProductInventory(p.id)),
        );
        if (cancelled) return;
        const rows: AttentionRow[] = [];
        results.forEach((res, i) => {
          const product = targets[i];
          if (res.status === 'fulfilled') {
            const inv: CatalogInventory = res.value.data;
            if (inv.inventoryState === 'out_of_stock' || inv.inventoryState === 'low_stock') {
              rows.push({
                productId: product.id,
                name: product.name,
                brand: product.brand,
                availableQuantity: inv.availableQuantity,
                lowStockThreshold: inv.lowStockThreshold,
                state: inv.inventoryState,
              });
            }
          } else if (product.stock === 0) {
            // Inventory record unreadable, but the denormalized canonical
            // stock is zero — still a genuine out-of-stock condition.
            rows.push({
              productId: product.id,
              name: product.name,
              brand: product.brand,
              availableQuantity: 0,
              lowStockThreshold: null,
              state: 'out_of_stock',
            });
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
    return () => {
      cancelled = true;
    };
  }, [activeTab, attentionLoaded, isLoadingProducts, displayedProducts]);

  // Re-hydrate the attention view if the underlying catalog set changes.
  React.useEffect(() => {
    setAttentionLoaded(false);
    setAttentionRows([]);
  }, [selectedBrandFilter, profile?.id]);

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

  const handleBulkApprove = () =>
    runBulk(
      'Approved',
      (id) => catalogApi.updateProduct(id, { status: 'live' }),
      (prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Live' } : p)),
    );

  const handleBulkReject = () =>
    runBulk(
      'Archived',
      (id) => catalogApi.updateProduct(id, { status: 'archived' }),
      (prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Flagged' } : p)),
    );

  const handleBulkDelete = () =>
    runBulk(
      'Deleted',
      (id) => catalogApi.deleteProduct(id),
      (prev) => prev.filter((p) => !selectedIds.has(p.id)),
    );

  const handleExportProductsCSV = () => {
    const rows = displayedProducts.filter((p) => selectedIds.has(p.id));
    if (!rows.length) return;
    const header = 'ID,Product Name,Brand,Category,Price,Status,Stock';
    const body = rows
      .map(
        (p) =>
          `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand.replace(/"/g, '""')}","${p.category}","${p.price}","${p.status}","${p.stock}"`,
      )
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

  // ----- Derived KPI tiles (all from loaded canonical data) -----
  const catalogStats = useMemo(() => {
    const total = products.length;
    const live = products.filter((p) => p.status === 'Live').length;
    const pending = products.filter((p) => p.status === 'Pending').length;
    const outOfStock = products.filter((p) => p.stock === 0).length;
    return { total, live, pending, outOfStock };
  }, [products]);

  const attentionSummary = useMemo(() => {
    const out = attentionRows.filter((r) => r.state === 'out_of_stock').length;
    const low = attentionRows.filter((r) => r.state === 'low_stock').length;
    return { out, low };
  }, [attentionRows]);

  // ----- Catalog tab columns -----
  const catalogColumns: DataTableColumn<ProductRow>[] = [
    {
      key: 'product',
      header: 'Product Details',
      sortValue: (p) => p.name,
      render: (p) => {
        const Icon = p.icon;
        return (
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-app-border shadow-inner ${p.color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-app-text-primary hover:text-app-accent transition-colors">
                <Link to={`/admin/products/${p.id}/edit`} className="hover:underline">
                  {p.name}
                </Link>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {p.productReferenceId ? (
                  <span className="text-[10px] font-mono font-bold text-app-text-primary tracking-wide">
                    {p.productReferenceId}
                  </span>
                ) : null}
                {p.sku ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-app-border" />
                    <span className="text-[10px] text-app-text-secondary opacity-70 font-bold">SKU {p.sku}</span>
                  </>
                ) : null}
                <span className="w-1 h-1 rounded-full bg-app-border" />
                <span className="text-[10px] text-app-text-secondary opacity-60 font-bold uppercase tracking-widest">{p.brand}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (p) => p.category,
      render: (p) => (
        <span className="text-[10px] px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold uppercase tracking-widest">
          {p.category}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortValue: (p) => Number(p.price.replace(/[^\d.]/g, '')) || 0,
      render: (p) => <div className="text-[14px] font-extrabold text-app-text-primary">{p.price}</div>,
    },
    {
      key: 'stock',
      header: 'Stock (available)',
      sortValue: (p) => p.stock,
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono font-bold text-app-text-primary">{p.stock}</span>
          {p.stock === 0 ? <Badge variant="danger">out of stock</Badge> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (p) => p.status,
      render: (p) => <Badge variant={statusBadgeVariant(p.status)}>{p.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Link
            to={`/admin/products/${p.id}/edit`}
            className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
            title="Edit product & stock"
          >
            <Pencil className="w-4 h-4" />
          </Link>
          <Link
            to={`/admin/products/${p.id}/edit`}
            className="p-2.5 bg-app-accent/10 border border-app-accent/20 rounded-xl text-app-accent hover:bg-app-accent/20 transition-all"
            title="Open product"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      ),
    },
  ];

  const bulkActions: BulkAction[] = [
    { label: 'Approve All', onClick: handleBulkApprove, variant: 'success', disabled: bulkActionLoading },
    { label: 'Reject All', onClick: handleBulkReject, variant: 'warning', disabled: bulkActionLoading },
    { label: 'Delete All', onClick: handleBulkDelete, variant: 'danger', disabled: bulkActionLoading },
    { label: 'Export Selected (CSV)', onClick: handleExportProductsCSV, variant: 'info', disabled: bulkActionLoading },
  ];

  // ----- Stock Attention tab columns -----
  const attentionColumns: DataTableColumn<AttentionRow>[] = [
    {
      key: 'product',
      header: 'Product',
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="text-[13px] font-bold text-app-text-primary">
            <Link to={`/admin/products/${r.productId}/edit`} className="hover:text-app-accent hover:underline">
              {r.name}
            </Link>
          </div>
          <div className="text-[10px] text-app-text-secondary opacity-60 font-bold uppercase tracking-widest">{r.brand}</div>
        </div>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      sortValue: (r) => r.availableQuantity ?? 0,
      render: (r) => (
        <span className="text-[13px] font-mono font-bold text-app-text-primary">
          {r.availableQuantity ?? '—'}
        </span>
      ),
    },
    {
      key: 'threshold',
      header: 'Low-stock threshold',
      sortValue: (r) => r.lowStockThreshold ?? 0,
      render: (r) => (
        <span className="text-[12px] font-mono text-app-text-secondary">{r.lowStockThreshold ?? '—'}</span>
      ),
    },
    {
      key: 'state',
      header: 'Current condition',
      sortValue: (r) => r.state,
      render: (r) => (
        <Badge variant={r.state === 'out_of_stock' ? 'danger' : 'warning'}>{r.state.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <Link
          to={`/admin/products/${r.productId}/edit`}
          className="px-3 py-1.5 bg-app-accent/10 border border-app-accent/20 rounded-lg text-app-accent text-[10px] font-bold uppercase tracking-wider hover:bg-app-accent/20 transition"
        >
          Manage stock
        </Link>
      ),
    },
  ];

  const tabs: TabItem[] = [
    { key: 'catalog', label: 'Catalog', icon: Package, badge: displayedProducts.length },
    { key: 'attention', label: 'Stock Attention', icon: AlertTriangle, badge: attentionLoaded ? attentionRows.length : undefined },
    { key: 'audit', label: 'Audit & Reconciliation', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Products &amp; Inventory</h1>
          <p className="text-app-text-secondary text-[12px]">
            Manage your catalog, pricing, listing status and stock in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/products/new')}
            className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Persistent stat cards — every value derives from loaded canonical data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Products" value={catalogStats.total} icon={Package} accent="orange" />
        <StatTile label="Live Products" value={catalogStats.live} icon={CheckCircle} accent="emerald" />
        <StatTile label="Pending Approval" value={catalogStats.pending} icon={Layers} accent="indigo" />
        <StatTile label="Out Of Stock" value={catalogStats.outOfStock} icon={TrendingDown} accent="rose" />
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as PageTab)} />

      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex bg-app-card border border-app-border rounded-2xl p-2 gap-2 overflow-x-auto scrollbar-hide">
            <div className="flex-1 min-w-[240px] relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent transition-colors" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, brands, SKU or reference id..."
                className="w-full bg-white border border-app-border rounded-xl pl-11 pr-4 py-2.5 text-[12px] text-app-text-primary placeholder:text-app-text-muted outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 transition-all font-medium"
              />
            </div>
            {isSeller && allBrands.filter((b) => ownedBrandIds.includes(b.id)).length > 1 && (
              <select
                value={selectedBrandFilter || ''}
                onChange={(e) => setSelectedBrandFilter(e.target.value || null)}
                className="bg-white border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 cursor-pointer"
              >
                <option value="">All my brands</option>
                {allBrands
                  .filter((b) => ownedBrandIds.includes(b.id))
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <BulkActionBar count={selectedIds.size} actions={bulkActions} onClear={() => setSelectedIds(new Set())} itemLabel="products" />

          <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
            {catalogError && (
              <div className="px-6 py-4 border-b border-app-border text-[12px] text-rose-600 bg-rose-500/10">
                Could not load catalog products: {catalogError.slice(0, 200)}
              </div>
            )}
            <DataTable
              columns={catalogColumns}
              rows={displayedProducts}
              getRowId={(p) => p.id}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              isLoading={isLoadingProducts}
              loadingMessage="Loading catalog products..."
              emptyMessage="No products yet. Create one from Add Product."
            />
          </GlassCard>
        </div>
      )}

      {activeTab === 'attention' && (
        <div className="space-y-4">
          <GlassCard hoverLift={false} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-app-text-secondary max-w-2xl">
              Live inventory conditions derived from current canonical stock. These are not
              persisted alerts — there is no history, acknowledgement or notification here.
              Adjust stock from a product's editor.
            </p>
            {attentionLoaded && (
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="danger">{attentionSummary.out} out of stock</Badge>
                <Badge variant="warning">{attentionSummary.low} low stock</Badge>
              </div>
            )}
          </GlassCard>

          {attentionError ? (
            <GlassCard hoverLift={false} className="px-6 py-4 text-[12px] text-rose-600 bg-rose-500/10">
              {attentionError}
            </GlassCard>
          ) : attentionLoading ? (
            <GlassCard hoverLift={false} className="p-12 text-center text-[12px] text-app-text-secondary">
              Checking current stock levels…
            </GlassCard>
          ) : attentionRows.length === 0 ? (
            <GlassCard hoverLift={false} className="p-12 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-extrabold text-app-text-primary">No stock needs attention</h3>
              <p className="text-xs text-app-text-secondary max-w-sm mx-auto">
                Every tracked product is currently above its low-stock threshold.
              </p>
            </GlassCard>
          ) : (
            <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
              <DataTable columns={attentionColumns} rows={attentionRows} getRowId={(r) => r.productId} />
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <GlassCard hoverLift={false} className="p-12 text-center space-y-3">
          <FileSpreadsheet className="w-12 h-12 text-app-text-secondary/50 mx-auto" />
          <h3 className="text-base font-extrabold text-app-text-primary">Inventory audit history is not available in V1</h3>
          <p className="text-xs text-app-text-secondary max-w-md mx-auto">
            A persisted stock-movement ledger and physical-variance reconciliation are planned
            for a future release. Current stock is shown live on the Catalog and Stock Attention tabs.
          </p>
        </GlassCard>
      )}

      {/*
        V1-DISABLED — variance reconciliation + stock-movement ledger UI preserved for future work.
        Do not re-enable without a genuine persisted inventory-history backend
        (store + ownership-scoped endpoint). The previous implementation was backed
        by localStorage (`choosify_stock_audit`) and a fabricated variance report,
        which is prohibited operational mock data.

        <GlassCard> ...variance report table... </GlassCard>
        <GlassCard> ...recent stock movements ledger... </GlassCard>
      */}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 z-[100] text-white ${
              toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-indigo-600' : 'bg-app-accent'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
