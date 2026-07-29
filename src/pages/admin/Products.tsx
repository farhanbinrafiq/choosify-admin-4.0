import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Smartphone,
  Tv,
  Shirt,
  Box,
  Eye,
  CheckCircle,
  Plus,
  Tag,
  Package,
  AlertTriangle,
  TrendingDown,
  Layers,
  History,
  Download,
  PlusCircle,
  FileSpreadsheet,
  RotateCcw,
  ExternalLink,
  Mail,
  Slack,
  X,
  Check,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AddProductModal from '../../components/admin/AddProductModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogProduct } from '../../types/catalog';
import { useInventory, StockAuditLog } from '../../contexts/InventoryContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatTile } from '../../components/ui/StatTile';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { BulkActionBar, BulkAction } from '../../components/ui/BulkActionBar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  seller: string;
  price: string;
  status: string;
  views: number;
  icon: typeof Smartphone;
  color: string;
};

type PageTab = 'catalog' | 'alerts' | 'audit';

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
    category: product.categoryName,
    seller: 'Platform Admin',
    price: `৳ ${Number(product.price || 0).toLocaleString()}`,
    status: product.status === 'live' ? 'Live' : product.status === 'draft' ? 'Pending' : 'Flagged',
    views: 0,
    icon,
    color,
  };
};

const statusBadgeVariant = (status: string) => {
  if (status === 'Live') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
};

const stockBadgeVariant = (status: string) => {
  if (status === 'in_stock') return 'success';
  if (status === 'low_stock') return 'warning';
  if (status === 'out_of_stock') return 'danger';
  return 'neutral';
};

export default function ProductsPage() {
  const { profile, activeBrandId, allBrands, sellerBrands } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isContentStudio = location.pathname.includes('content-studio');

  const {
    inventoryItems,
    auditLog,
    stockAlerts,
    updateStock,
    acknowledgeAlert,
    getVarianceReport,
    bulkStockImport,
    undoLastAdjustment,
    canUndo,
  } = useInventory();

  // ----- Catalog state -----
  const [isModalOpen, setIsModalOpen] = useState(location.state?.openAddModal || false);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | null>(activeBrandId);
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

  // ----- Audit / adjustment modal state -----
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustProductLocked, setAdjustProductLocked] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<StockAuditLog['reason']>('restock');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustNotes, setAdjustNotes] = useState('');

  // ----- Audit history viewer modal state -----
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  // ----- Low Stock Alerts tab-local state -----
  const [alertFilter, setAlertFilter] = useState<'all' | 'warning' | 'critical'>('all');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackIntegration, setSlackIntegration] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleBulkApprove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map((id) => catalogApi.updateProduct(id, { status: 'live' })));
      setProducts((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Live' } : p)));
      showToast(`Approved ${ids.length} products to Live`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk approve failed', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map((id) => catalogApi.updateProduct(id, { status: 'archived' })));
      setProducts((prev) => prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'Flagged' } : p)));
      showToast(`Archived ${ids.length} products`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk reject failed', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(ids.map((id) => catalogApi.deleteProduct(id)));
      setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      showToast(`Deleted ${ids.length} products from catalog`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk delete failed', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportProductsCSV = () => {
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Product Name,Brand,Category,Price,Status,Views'].join(',') +
      '\n' +
      selectedProducts
        .map(
          (p) =>
            `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand.replace(/"/g, '""')}","${p.category}","${p.price}","${p.status}","${p.views}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_bulk_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${selectedIds.size} products to CSV`);
  };

  const handleExportCSV = (data: any[], fileName: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) => Object.values(row).map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${data.length} records successfully!`);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target?.result as string;
      const res = bulkStockImport(csvData);
      if (res.success) {
        showToast(`Import completed! Updated stock for ${res.count} SKUs.`, 'success');
      } else {
        showToast(`Import failed: ${res.error || 'Invalid file structure'}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  React.useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setCatalogError(null);
      try {
        const catalogProducts = await catalogApi.listProducts();
        if (!cancelled) {
          setProducts(catalogProducts.map(mapCatalogProduct));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load catalog products.';
          setCatalogError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProducts(false);
        }
      }
    };
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (isModalOpen) {
      setIsModalOpen(false);
      navigate('/dashboard/content-studio/products/new');
    }
  }, [isModalOpen, navigate]);

  React.useEffect(() => {
    setSelectedBrandFilter(activeBrandId);
  }, [activeBrandId]);

  // Filter products based on user role and active seller brand context
  const targetBrand = allBrands.find((b) => b.id === selectedBrandFilter);
  const sellerRelations = sellerBrands.filter((r) => r.seller_user_id === profile?.id);
  const ownedBrandIds = sellerRelations.map((r) => r.brand_id);
  const ownedBrandNames = allBrands.filter((b) => ownedBrandIds.includes(b.id)).map((b) => b.name.toLowerCase());

  const displayedProducts = products.filter((p) => {
    if (profile?.role === 'seller') {
      if (targetBrand) {
        const targetBrandNameLower = targetBrand.name.toLowerCase();
        return (
          p.brand &&
          (p.brand.toLowerCase() === targetBrandNameLower ||
            p.brand.toLowerCase().includes(targetBrandNameLower) ||
            targetBrandNameLower.includes(p.brand.toLowerCase()))
        );
      }
      return p.brand && ownedBrandNames.some((name) => p.brand.toLowerCase() === name || p.brand.toLowerCase().includes(name) || name.includes(p.brand.toLowerCase()));
    }
    return true;
  });

  const handleAddProduct = (data: any) => {
    const newProduct = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.productName,
      brand: data.brandName || data.customBrand,
      category: data.category,
      seller: 'Platform Admin',
      price: `৳ ${data.discountedPrice.toLocaleString()}`,
      status: 'Pending',
      views: 0,
      icon: data.category === 'Mobile' ? Smartphone : Box,
      color: 'text-app-accent bg-app-accent/10',
    };
    setProducts([newProduct, ...products]);
    showToast('Product added successfully as Draft');
  };

  // ----- Inventory-derived stats (persistent across all tabs) -----
  const inventoryKpis = useMemo(() => {
    const totalSKUs = inventoryItems.length;
    const lowStock = inventoryItems.filter((i) => i.status === 'low_stock').length;
    const outOfStock = inventoryItems.filter((i) => i.status === 'out_of_stock').length;
    return { totalSKUs, lowStock, outOfStock };
  }, [inventoryItems]);

  const catalogStats = useMemo(() => {
    const total = products.length;
    const live = products.filter((p) => p.status === 'Live').length;
    const pending = products.filter((p) => p.status === 'Pending').length;
    return { total, live, pending };
  }, [products]);

  const getInventoryForProduct = (productId: string) => inventoryItems.find((i) => i.productId === productId);

  const openRestockModal = (productId?: string) => {
    if (productId) {
      setAdjustProductId(productId);
      setAdjustProductLocked(true);
    } else {
      setAdjustProductId('');
      setAdjustProductLocked(false);
    }
    setAdjustmentType('restock');
    setAdjustQty(10);
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const commitAdjustment = () => {
    const item = inventoryItems.find((i) => i.productId === adjustProductId);
    if (!item) {
      showToast('Select a product before committing the adjustment.', 'error');
      return;
    }
    if (adjustQty <= 0) {
      showToast('Quantity must be greater than 0.', 'error');
      return;
    }

    let newQty = item.currentStock;
    if (adjustmentType === 'restock' || adjustmentType === 'return') {
      newQty += adjustQty;
    } else if (adjustmentType === 'damage_loss' || adjustmentType === 'order_placed') {
      newQty = Math.max(0, newQty - adjustQty);
    } else if (adjustmentType === 'manual_adjustment') {
      newQty = adjustQty;
    }

    updateStock(adjustProductId, newQty, adjustmentType, adjustNotes || `Manual adjustment type: ${adjustmentType}`);
    showToast(`Successfully updated stock for ${item.productName}!`, 'success');
    setAdjustModalOpen(false);
  };

  // ----- Catalog tab: DataTable columns -----
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
                <Link to={`/dashboard/content-studio/products/${p.id}/edit`} className="hover:underline">
                  {p.name}
                </Link>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-app-text-secondary opacity-60 font-bold uppercase tracking-widest">{p.brand}</span>
                <span className="w-1 h-1 rounded-full bg-app-border" />
                <span className="text-[10px] text-app-accent font-bold">{p.views.toLocaleString()} views</span>
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
      header: 'Affiliate Price',
      sortValue: (p) => Number(p.price.replace(/[^\d.]/g, '')) || 0,
      render: (p) => (
        <div>
          <div className="text-[14px] font-extrabold text-app-text-primary">{p.price}</div>
          <div className="text-[9px] text-app-text-secondary font-bold uppercase tracking-widest">Est. Commission: ৳ 420</div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      sortValue: (p) => getInventoryForProduct(p.id)?.availableStock ?? -1,
      render: (p) => {
        const inv = getInventoryForProduct(p.id);
        if (!inv) return <span className="text-[11px] text-app-text-secondary italic">Not tracked</span>;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-bold text-app-text-primary">{inv.availableStock}</span>
              <Badge variant={stockBadgeVariant(inv.status)}>{inv.status.replace('_', ' ')}</Badge>
            </div>
            <div className="text-[9px] text-app-text-secondary">Min threshold: {inv.minimumStock}</div>
          </div>
        );
      },
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
      render: (p) => {
        const inv = getInventoryForProduct(p.id);
        return (
          <div className="flex justify-end gap-2">
            {inv && (
              <>
                <button
                  onClick={() => setHistoryProductId(p.id)}
                  className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
                  title="View audit history"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openRestockModal(p.id)}
                  className="p-2.5 bg-app-accent/10 border border-app-accent/20 rounded-xl text-app-accent hover:bg-app-accent/20 transition-all"
                  title="Restock this item"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </>
            )}
            <Link
              to={`/dashboard/content-studio/products/${p.id}/edit`}
              className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/40 transition-all"
            >
              <Tag className="w-4 h-4" />
            </Link>
            <Link
              to={`/dashboard/content-studio/products/${p.id}/edit`}
              className="p-2.5 bg-app-accent/10 border border-app-accent/20 rounded-xl text-app-accent hover:bg-app-accent/20 transition-all"
            >
              <Eye className="w-4 h-4" />
            </Link>
          </div>
        );
      },
    },
  ];

  const bulkActions: BulkAction[] = [
    { label: 'Approve All', onClick: handleBulkApprove, variant: 'success', disabled: bulkActionLoading },
    { label: 'Reject All', onClick: handleBulkReject, variant: 'warning', disabled: bulkActionLoading },
    { label: 'Delete All', onClick: handleBulkDelete, variant: 'danger', disabled: bulkActionLoading },
    { label: 'Export Selected (CSV)', onClick: handleExportProductsCSV, variant: 'info', disabled: bulkActionLoading },
  ];

  // ----- Low Stock Alerts tab -----
  const filteredAlerts = useMemo(() => {
    return stockAlerts.filter((alert) => alertFilter === 'all' || alert.severity === alertFilter);
  }, [stockAlerts, alertFilter]);

  const alertColumns: DataTableColumn<(typeof stockAlerts)[number]>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortValue: (a) => a.createdAt,
      render: (a) => <span className="text-app-text-secondary text-[11px] font-mono">{new Date(a.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'sku',
      header: 'SKU / Code',
      render: (a) => {
        const product = inventoryItems.find((i) => i.productId === a.productId);
        return <span className="font-mono text-[11px] font-bold text-app-text-secondary">{product?.sku || 'N/A'}</span>;
      },
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => <span className="text-[11px] font-bold capitalize text-app-text-secondary">{a.type.replace('_', ' ')}</span>,
    },
    {
      key: 'severity',
      header: 'Severity',
      sortValue: (a) => a.severity,
      render: (a) => <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'}>{a.severity}</Badge>,
    },
    { key: 'message', header: 'Alert Message', render: (a) => <span className="text-[11px] text-app-text-secondary">{a.message}</span> },
    {
      key: 'action',
      header: 'Action Required',
      render: (a) =>
        a.acknowledged ? (
          <span className="text-app-text-secondary text-[11px] flex items-center gap-1 font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> Acknowledged
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                acknowledgeAlert(a.id);
                showToast('Alert acknowledged successfully.');
              }}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-app-text-secondary border border-app-border rounded text-[10px] font-bold uppercase transition"
            >
              Acknowledge
            </button>
            <button
              onClick={() => {
                openRestockModal(a.productId);
              }}
              className="px-2 py-1 bg-app-accent hover:bg-app-accent-hover text-white rounded text-[10px] font-bold uppercase transition"
            >
              Restock
            </button>
          </div>
        ),
    },
  ];

  // ----- Audit & Reconciliation tab -----
  const varianceReport = getVarianceReport();

  const varianceColumns: DataTableColumn<(typeof varianceReport)[number]>[] = [
    {
      key: 'name',
      header: 'Product / Variant Name',
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="font-bold text-app-text-primary text-[13px]">{r.name}</div>
          <span className="text-[10px] text-app-text-secondary font-mono">ID: {r.itemId}</span>
        </div>
      ),
    },
    { key: 'recorded', header: 'Recorded System Count', render: (r) => <span className="font-mono font-bold text-[13px]">{r.recorded} units</span> },
    { key: 'physical', header: 'Physical Verified Count', render: (r) => <span className="font-mono font-bold text-[13px]">{r.physical} units</span> },
    {
      key: 'variance',
      header: 'Variance Discrepancy',
      sortValue: (r) => r.difference,
      render: (r) =>
        r.difference === 0 ? (
          <span className="text-emerald-600 font-mono font-bold text-[13px]">0 (Match)</span>
        ) : r.difference > 0 ? (
          <span className="text-emerald-600 font-mono font-bold text-[13px]">+{r.difference} surplus</span>
        ) : (
          <span className="text-rose-600 font-mono font-bold text-[13px]">{r.difference} deficit</span>
        ),
    },
    {
      key: 'rating',
      header: 'Variance Rating',
      render: (r) => (r.difference === 0 ? <Badge variant="success">Balanced</Badge> : <Badge variant="warning">Discrepancy Detected</Badge>),
    },
    {
      key: 'corrective',
      header: 'Corrective Action',
      align: 'right',
      render: (r) =>
        r.difference !== 0 ? (
          <button
            onClick={() => {
              updateStock(r.itemId, r.physical, 'manual_adjustment', 'Automatic reconciliation override to physical count');
              showToast(`Auto-reconciled ${r.name} to physically verified ${r.physical} units!`, 'success');
            }}
            className="px-3 py-1 bg-app-accent hover:bg-app-accent-hover text-white font-bold text-[10px] uppercase rounded tracking-wider transition"
          >
            Sync to Physical
          </button>
        ) : (
          <span className="text-app-text-secondary text-[11px] font-mono italic">Verified match</span>
        ),
    },
  ];

  const tabs: TabItem[] = [
    { key: 'catalog', label: 'Catalog', icon: Package, badge: displayedProducts.length },
    { key: 'alerts', label: 'Low Stock Alerts', icon: AlertTriangle, badge: filteredAlerts.length },
    { key: 'audit', label: 'Audit & Reconciliation', icon: FileSpreadsheet },
  ];

  const adjustSelectedItem = inventoryItems.find((i) => i.productId === adjustProductId);
  const historyItem = historyProductId ? inventoryItems.find((i) => i.productId === historyProductId) : null;
  const historyLogs = historyProductId ? auditLog.filter((l) => l.productId === historyProductId).slice(0, 8) : [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">
            {isContentStudio ? 'Product Studio (Visual Product CMS)' : 'Products & Inventory'}
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            {isContentStudio
              ? 'Live experience builder, storefront mockups, and dynamic catalog releases'
              : 'Manage platform catalog, pricing, seller listings and stock in one place'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canUndo && (
            <button
              onClick={() => {
                const success = undoLastAdjustment();
                showToast(success ? 'Successfully reverted the last stock adjustment!' : 'No actions left to undo', success ? 'info' : 'error');
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent text-[11px] font-bold uppercase tracking-wider transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo last change
            </button>
          )}
          <button className="p-2.5 bg-white border border-app-border rounded-xl text-app-text-secondary hover:text-app-accent hover:border-app-accent/30 transition-all">
            <Filter className="w-4 h-4" />
          </button>
          {isContentStudio ? (
            <Link
              to="/dashboard/content-studio/products/new"
              className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Visual Product
            </Link>
          ) : (
            <button
              onClick={() => navigate('/dashboard/content-studio/products/new')}
              className="flex items-center gap-2 bg-app-accent hover:bg-app-accent-hover text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-app-accent/20 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Persistent stat cards — visible across all tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Total Products" value={catalogStats.total} icon={Package} accent="orange" />
        <StatTile label="Live Products" value={catalogStats.live} icon={CheckCircle} accent="emerald" />
        <StatTile label="Pending Approval" value={catalogStats.pending} icon={Layers} accent="indigo" />
        <StatTile label="Low Stock SKUs" value={inventoryKpis.lowStock} icon={AlertTriangle} accent="orange" />
        <StatTile label="Out Of Stock SKUs" value={inventoryKpis.outOfStock} icon={TrendingDown} accent="rose" />
      </div>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as PageTab)} />

      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex bg-app-card border border-app-border rounded-2xl p-2 gap-2 overflow-x-auto scrollbar-hide">
            <div className="flex-1 min-w-[240px] relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent transition-colors" />
              <input
                placeholder="Search products, brands, sellers..."
                className="w-full bg-white border border-app-border rounded-xl pl-11 pr-4 py-2.5 text-[12px] text-app-text-primary placeholder:text-app-text-muted outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 transition-all font-medium"
              />
            </div>
            <div className="flex gap-2">
              {profile?.role === 'seller' && (
                <select
                  value={selectedBrandFilter || ''}
                  onChange={(e) => setSelectedBrandFilter(e.target.value || null)}
                  className="bg-white border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 cursor-pointer"
                >
                  <option value="">All Brands</option>
                  {allBrands.filter((b) => ownedBrandIds.includes(b.id)).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <select className="bg-white border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 cursor-pointer">
                <option>All Categories</option>
                <option>Mobile</option>
                <option>Electronics</option>
                <option>Fashion</option>
              </select>
              <select className="bg-white border border-app-border rounded-xl px-4 py-2.5 text-[12px] text-app-text-primary font-medium outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/15 cursor-pointer">
                <option>Status: Any</option>
                <option>Live</option>
                <option>Pending</option>
                <option>Flagged</option>
              </select>
            </div>
          </div>

          <BulkActionBar count={selectedIds.size} actions={bulkActions} onClear={() => setSelectedIds(new Set())} itemLabel="products" />

          <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
            {catalogError && (
              <div className="px-6 py-4 border-b border-app-border text-[12px] text-amber-600 bg-amber-500/10">
                Could not load catalog products: {catalogError.slice(0, 180)}
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
              emptyMessage="No products in catalog yet. Publish one from Product Studio."
            />
          </GlassCard>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <GlassCard hoverLift={false} className="flex items-center justify-between flex-wrap gap-4 p-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-app-text-secondary">Filter Alerts:</span>
              <div className="flex gap-1.5">
                {(['all', 'warning', 'critical'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setAlertFilter(sev)}
                    className={`px-3 py-1.5 text-[10px] font-black rounded uppercase tracking-wider transition-all ${
                      alertFilter === sev ? 'bg-app-accent text-white' : 'bg-slate-100 text-slate-500 hover:text-app-text-primary'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => {
                    setEmailAlerts(e.target.checked);
                    showToast(`Email notifications ${e.target.checked ? 'enabled' : 'disabled'}!`, 'info');
                  }}
                  className="rounded border-app-border text-app-accent focus:ring-app-accent"
                />
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email Alerts
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slackIntegration}
                  onChange={(e) => {
                    setSlackIntegration(e.target.checked);
                    showToast(`Slack channel integration ${e.target.checked ? 'activated' : 'deactivated'}!`, 'info');
                  }}
                  className="rounded border-app-border text-app-accent focus:ring-app-accent"
                />
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <Slack className="w-3 h-3" /> Slack Sync
                </span>
              </label>
            </div>
          </GlassCard>

          {filteredAlerts.length === 0 ? (
            <GlassCard hoverLift={false} className="p-12 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-extrabold text-app-text-primary">All Stock Levels Healthy</h3>
              <p className="text-xs text-app-text-secondary max-w-sm mx-auto">
                No active low stock alerts detected. Minimum thresholds are satisfied across all SKUs.
              </p>
            </GlassCard>
          ) : (
            <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
              <DataTable columns={alertColumns} rows={filteredAlerts} getRowId={(a) => a.id} />
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-6">
          <GlassCard hoverLift={false} className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-app-text-primary flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-app-accent" />
                Physical Variance Reconciliation Audit Report
              </h3>
              <p className="text-xs text-app-text-secondary max-w-2xl">
                Compare recorded catalog stock with verified physical warehouse count audits. Discrepancies require manual correction approval.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-app-border text-app-text-secondary text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Import Stock (CSV)</span>
                <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
              </label>
              <button
                onClick={() => openRestockModal()}
                className="flex items-center gap-1 bg-app-accent hover:bg-app-accent-hover text-white text-[11px] font-bold px-3 py-2 rounded-lg transition"
              >
                <PlusCircle className="w-3.5 h-3.5" /> New Adjustment
              </button>
              <button
                onClick={() =>
                  handleExportCSV(varianceReport, `choosify_stock_variance_reconciliation_report_${new Date().toISOString().slice(0, 10)}.csv`)
                }
                className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-app-border text-app-text-secondary text-[11px] font-bold px-3 py-2 rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" /> Export Variance Ledger
              </button>
            </div>
          </GlassCard>

          <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
            <DataTable columns={varianceColumns} rows={varianceReport} getRowId={(r) => r.itemId} />
          </GlassCard>

          <GlassCard hoverLift={false} className="p-6 space-y-4">
            <h3 className="text-base font-extrabold text-app-text-primary flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              Recent Stock Movements & Adjustments Ledger
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {auditLog.slice(0, 30).map((log) => {
                const product = inventoryItems.find((i) => i.productId === log.productId);
                return (
                  <div
                    key={log.id}
                    className="bg-white border border-app-border p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-app-text-primary text-[13px]">{product?.productName || 'Catalog Product'}</span>
                      </div>
                      <div className="text-[11px] text-app-text-secondary flex items-center gap-2 flex-wrap font-mono">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-bold uppercase tracking-wider text-indigo-500">{log.reason.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>
                          Actor: <span className="font-bold text-app-text-secondary">{log.actedBy}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-app-text-secondary italic">Notes: "{log.notes}"</p>
                    </div>
                    <div className="text-right flex items-center sm:flex-col justify-between sm:justify-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${log.change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {log.change > 0 ? `+${log.change}` : log.change} units
                      </span>
                      <span className="text-[10px] text-app-text-secondary">
                        Stock: {log.previousStock} → {log.newStock}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Restock / manual adjustment modal — shared by Catalog quick-restock, Alerts, and Audit tab */}
      <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Stock Adjustment" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Select SKU / Product</label>
            <select
              value={adjustProductId}
              onChange={(e) => setAdjustProductId(e.target.value)}
              disabled={adjustProductLocked}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition disabled:opacity-60"
            >
              <option value="">Select a product...</option>
              {inventoryItems.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.productName} ({item.sku} - Stock: {item.currentStock})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Adjustment Type</label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as StockAuditLog['reason'])}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            >
              <option value="restock">Restock Inventory (+ Add)</option>
              <option value="return">Customer Return (+ Add)</option>
              <option value="damage_loss">Damage / Theft (- Deduct)</option>
              <option value="manual_adjustment">Direct Physical Count Override (= Set)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Quantity</label>
            <input
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
              min={1}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary font-mono focus:border-app-accent focus:outline-none transition"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Notes</label>
            <textarea
              placeholder="Enter reason for this correction..."
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              className="w-full bg-white border border-app-border rounded-lg p-2 text-xs text-app-text-primary h-20 focus:border-app-accent focus:outline-none transition"
            />
          </div>
          {adjustSelectedItem && (
            <p className="text-[10px] text-app-text-secondary">
              Current stock for <span className="font-bold">{adjustSelectedItem.productName}</span>: {adjustSelectedItem.currentStock} units
            </p>
          )}
          <button
            onClick={commitAdjustment}
            className="w-full py-2 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
          >
            Commit Adjustment
          </button>
        </div>
      </Modal>

      {/* Audit history viewer modal */}
      <Modal isOpen={!!historyProductId} onClose={() => setHistoryProductId(null)} title={historyItem ? `Audit History — ${historyItem.productName}` : 'Audit History'}>
        {historyLogs.length === 0 ? (
          <p className="text-[11px] text-app-text-secondary italic">No recorded stock adjustments found for this product yet.</p>
        ) : (
          <div className="space-y-2">
            {historyLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded border border-app-border text-[11px] font-mono">
                <div className="flex items-center gap-4">
                  <span className="text-app-text-secondary">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${log.change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {log.change > 0 ? `+${log.change}` : log.change}
                  </span>
                  <span className="text-app-text-secondary font-bold capitalize">{log.reason.replace('_', ' ')}</span>
                </div>
                <div className="text-app-text-secondary">
                  By: <span className="font-bold">{log.actedBy}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <AddProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleAddProduct} />

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
