import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ArrowRight, 
  RotateCcw, 
  History, 
  TrendingDown, 
  TrendingUp, 
  Calendar, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  RefreshCw,
  Mail,
  Slack,
  Check,
  X,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInventory, InventoryItem, StockAuditLog, StockAlert } from '../../contexts/InventoryContext';
import { useOrders } from '../../contexts/OrdersContext';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';

export default function Inventory() {
  const { 
    inventoryItems, 
    auditLog, 
    stockAlerts, 
    updateStock, 
    setMinimumStock, 
    acknowledgeAlert, 
    getVarianceReport, 
    bulkStockImport, 
    undoLastAdjustment, 
    canUndo,
    triggerMockSale
  } = useInventory();

  const { orders } = useOrders();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'adjustments' | 'reconciliation'>('overview');
  const [viewType, setViewType] = useState<'list' | 'grid' | 'chart'>('list');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [alertFilter, setAlertFilter] = useState<'all' | 'warning' | 'critical'>('all');

  // Manual Adjustment Form state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<StockAuditLog['reason']>('restock');
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Expansion row state for Overview table
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Configurable email/Slack states for automated low stock notification settings
  const [slackIntegration, setSlackIntegration] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Custom Alert state
  const [customThresholdId, setCustomThresholdId] = useState<string | null>(null);
  const [customThresholdVal, setCustomThresholdVal] = useState<number>(10);

  // Toast / Feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Categories list extracted from items
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(inventoryItems.map(item => item.categoryId)))];
  }, [inventoryItems]);

  // Handle toast notifications on actions
  const triggerUndo = () => {
    const success = undoLastAdjustment();
    if (success) {
      showToast('Successfully reverted the last stock adjustment!', 'info');
    } else {
      showToast('No actions left to undo', 'error');
    }
  };

  const handleManualAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      showToast('Please select a product for stock adjustment.', 'error');
      return;
    }
    if (adjustQty <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }
    setIsConfirmOpen(true);
  };

  const confirmManualAdjustment = () => {
    const item = inventoryItems.find(i => i.productId === selectedProduct);
    if (!item) return;

    // Deduce new quantity
    let newQty = item.currentStock;
    if (adjustmentType === 'restock' || adjustmentType === 'return') {
      newQty += adjustQty;
    } else if (adjustmentType === 'damage_loss' || adjustmentType === 'order_placed') {
      newQty = Math.max(0, newQty - adjustQty);
    } else if (adjustmentType === 'manual_adjustment') {
      // Direct replacement for manual correction
      newQty = adjustQty;
    }

    updateStock(selectedProduct, newQty, adjustmentType, adjustNotes || `Manual adjustment type: ${adjustmentType}`);
    showToast(`Successfully updated stock for ${item.productName}!`, 'success');
    
    // Reset form
    setSelectedProduct('');
    setAdjustQty(10);
    setAdjustNotes('');
    setIsConfirmOpen(false);
  };

  const handleTriggerSaleDemo = (productId: string) => {
    const item = inventoryItems.find(i => i.productId === productId);
    if (!item) return;
    if (item.currentStock <= 0) {
      showToast('Product is already out of stock', 'error');
      return;
    }
    triggerMockSale(productId, 1);
    showToast(`Triggered mock purchase. 1 unit of ${item.productName} allocated immediately, stock deduction schedules in progress!`, 'info');
  };

  // Export to CSV helper
  const handleExportCSV = (data: any[], fileName: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
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
  };

  const handleSaveCustomThreshold = (productId: string) => {
    setMinimumStock(productId, customThresholdVal);
    showToast(`Updated minimum threshold to ${customThresholdVal} units.`, 'success');
    setCustomThresholdId(null);
  };

  // Filtered Inventory items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.categoryId === categoryFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventoryItems, searchTerm, categoryFilter, statusFilter]);

  // Paginated Items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return stockAlerts.filter(alert => {
      if (alertFilter === 'all') return true;
      return alert.severity === alertFilter;
    });
  }, [stockAlerts, alertFilter]);

  // Total KPIs
  const kpis = useMemo(() => {
    const totalSKUs = inventoryItems.length;
    const inStock = inventoryItems.filter(i => i.status === 'in_stock').length;
    const lowStock = inventoryItems.filter(i => i.status === 'low_stock').length;
    const outOfStock = inventoryItems.filter(i => i.status === 'out_of_stock').length;
    return { totalSKUs, inStock, lowStock, outOfStock };
  }, [inventoryItems]);

  // Chart Data Calculations
  const categoryChartData = useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    inventoryItems.forEach(item => {
      categoriesMap[item.categoryId] = (categoriesMap[item.categoryId] || 0) + item.currentStock;
    });
    return Object.keys(categoriesMap).map(cat => ({ name: cat, value: categoriesMap[cat] }));
  }, [inventoryItems]);

  const stockLevelChartData = useMemo(() => {
    return inventoryItems.map(item => ({
      name: item.productName.length > 15 ? item.productName.slice(0, 15) + '...' : item.productName,
      available: item.availableStock,
      allocated: item.allocatedStock,
      minThreshold: item.minimumStock
    }));
  }, [inventoryItems]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3'];

  return (
    <div className="space-y-6 pb-12 bg-[#F8FAFC] text-slate-800 min-h-screen p-6 sm:p-8 rounded-2xl border border-gray-200">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-8 right-8 z-[999] px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center space-x-3${
              toast.type === 'success' 
                ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' 
                : toast.type === 'error' 
                ? 'bg-rose-950/90 text-rose-400 border-rose-500/30' 
                : 'bg-indigo-950/90 text-indigo-400 border-indigo-500/30'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-400" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-app-card/20 z-[999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#121424] border border-app-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center space-x-3 text-amber-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Confirm Stock Adjustment</h3>
            </div>
            <p className="text-xs text-app-text-secondary leading-relaxed">
              Are you sure you want to perform a manual stock change for this item? This action will generate a permanent entry in the system audit log and automatically recalculate inventory health ratings.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-app-bg text-app-text-secondary rounded-lg text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={confirmManualAdjustment}
                className="px-4 py-2 bg-[#FF6A00] text-app-text-primary rounded-lg text-xs font-bold hover:bg-[#E05B00] transition"
              >
                Yes, Commit Stock
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Package className="w-6 h-6 text-[#FF6A00]" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Inventory & Stock Management</h1>
            <span className="text-[10px] bg-[#FF6A00]/10 text-[#FF6A00] border border-[#FF6A00]/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Control Panel
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-channel inventory control, predictive restocks, localized stockout forecasts, and complete automated ledger auditing.
          </p>
        </div>

        {/* Header Toolbar controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 bg-[#121424] border border-app-border rounded p-1">
            <Calendar className="w-3.5 h-3.5 text-app-text-secondary ml-1.5" />
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-all${
                  dateRange === range ? 'bg-[#FF6A00] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 bg-[#121424] border border-app-border rounded p-1">
            <button 
              onClick={() => setViewType('list')}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all uppercase${viewType === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              List
            </button>
            <button 
              onClick={() => setViewType('grid')}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all uppercase${viewType === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewType('chart')}
              className={`px-3 py-1 rounded text-[10px] font-bold transition-all uppercase${viewType === 'chart' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              Charts
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121424] border border-app-border p-4 rounded-xl shadow-md flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-indigo-950/50 text-indigo-400 border border-indigo-900/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Unique SKUs</div>
            <div className="text-xl font-extrabold font-mono text-app-text-primary mt-0.5">{kpis.totalSKUs}</div>
            <div className="text-[9px] text-app-text-secondary mt-1">Multi-variant tracking active</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-xl shadow-md flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Healthy Stock</div>
            <div className="text-xl font-extrabold font-mono text-app-text-primary mt-0.5">{kpis.inStock}</div>
            <div className="text-[9px] text-emerald-500 mt-1">✓ Over threshold target</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-xl shadow-md flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-amber-950/50 text-amber-500 border border-amber-900/30 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Low Stock SKUs</div>
            <div className="text-xl font-extrabold font-mono text-amber-500 mt-0.5">{kpis.lowStock}</div>
            <div className="text-[9px] text-amber-400 mt-1">Requires immediate order replenishment</div>
          </div>
        </div>

        <div className="bg-[#121424] border border-app-border p-4 rounded-xl shadow-md flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-rose-950/50 text-rose-500 border border-rose-900/30">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Out Of Stock</div>
            <div className="text-xl font-extrabold font-mono text-rose-500 mt-0.5">{kpis.outOfStock}</div>
            <div className="text-[9px] text-rose-400 mt-1">Disrupting customer checkouts</div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-app-border flex items-center justify-between">
        <div className="flex space-x-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Stock Overview', count: filteredItems.length },
            { id: 'alerts', label: 'Low Stock Alerts', count: filteredAlerts.length },
            { id: 'adjustments', label: 'Stock Adjustments', count: null },
            { id: 'reconciliation', label: 'Audit & Reconciliation', count: null },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-xs font-bold tracking-wider relative transition-all whitespace-nowrap${
                activeTab === tab.id ? 'text-[#FF6A00]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black${
                    tab.id === 'alerts' && tab.count > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6A00]" />
              )}
            </button>
          ))}
        </div>

        {/* Undo action button on right */}
        {canUndo && (
          <button
            onClick={triggerUndo}
            className="flex items-center space-x-1 px-3 py-1 bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-900 transition-all text-[10px] font-bold uppercase tracking-wider animate-bounce"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo last change</span>
          </button>
        )}
      </div>

      {/* Main Tab Contents */}
      <div className="min-h-[400px]">

        {/* TAB 1: STOCK OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Filter controls bar */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between bg-[#121424] p-4 rounded-xl border border-app-border">
              <div className="flex flex-1 flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search inventory by product name, SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-app-card border border-app-border rounded-lg text-xs focus:border-[#FF6A00] focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>

                <div className="flex space-x-2">
                  <div className="flex items-center space-x-1.5 bg-app-card border border-app-border px-3 rounded-lg">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-transparent border-none text-xs focus:outline-none text-app-text-secondary font-medium py-1"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat} className="bg-[#121424]">{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5 bg-app-card border border-app-border px-3 rounded-lg">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-transparent border-none text-xs focus:outline-none text-app-text-secondary font-medium py-1"
                    >
                      <option value="All" className="bg-[#121424]">All Status</option>
                      <option value="in_stock" className="bg-[#121424]">In Stock</option>
                      <option value="low_stock" className="bg-[#121424]">Low Stock</option>
                      <option value="out_of_stock" className="bg-[#121424]">Out Of Stock</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-1 bg-app-bg hover:bg-slate-700 text-app-text-primary text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Import Stock (CSV)</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => handleExportCSV(
                    filteredItems.map(i => ({ 
                      SKU: i.sku, 
                      Name: i.productName, 
                      CurrentStock: i.currentStock, 
                      Allocated: i.allocatedStock, 
                      Available: i.availableStock, 
                      MinStock: i.minimumStock, 
                      Status: i.status 
                    })), 
                    `choosify_inventory_report_${new Date().toISOString().slice(0,10)}.csv`
                  )}
                  className="flex items-center space-x-1 bg-app-bg hover:bg-slate-700 text-app-text-primary text-[11px] font-bold px-3 py-2 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {/* List View */}
            {viewType === 'list' && (
              <div className="bg-[#121424] border border-app-border rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-app-border text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-[#16192E]">
                        <th className="p-4">Product Name</th>
                        <th className="p-4">SKU / Code</th>
                        <th className="p-4">Current Stock</th>
                        <th className="p-4">Allocated</th>
                        <th className="p-4">Available</th>
                        <th className="p-4">Min Threshold</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Simulation / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs">
                      {paginatedItems.map(item => {
                        const isExpanded = expandedItemId === item.productId;
                        return (
                          <React.Fragment key={item.productId}>
                            <tr className={`hover:bg-slate-800/50 transition-colors${isExpanded ? 'bg-slate-800/30' : ''}`}>
                              <td className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-app-card rounded border border-app-border">
                                    <Package className="w-4 h-4 text-app-text-secondary" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-app-text-primary text-[13px]">{item.productName}</div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.categoryId}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-[11px] text-app-text-secondary font-semibold">{item.sku}</td>
                              <td className="p-4 font-mono font-bold text-app-text-primary text-[13px]">{item.currentStock}</td>
                              <td className="p-4 font-mono text-amber-500/90 font-medium">
                                {item.allocatedStock > 0 ? (
                                  <span className="flex items-center space-x-1">
                                    <span>{item.allocatedStock}</span>
                                    <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 rounded-full font-bold">Allocated</span>
                                  </span>
                                ) : '0'}
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <div className="font-mono font-bold text-[#FF6A00]">{item.availableStock}</div>
                                  <div className="w-20 h-1.5 bg-app-bg rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full${item.availableStock > item.minimumStock ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                      style={{ width: `${Math.min(100, (item.availableStock / (item.maximumStock || 100)) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                {customThresholdId === item.productId ? (
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      value={customThresholdVal}
                                      onChange={(e) => setCustomThresholdVal(parseInt(e.target.value, 10) || 0)}
                                      className="w-12 p-1 bg-app-card border border-app-border rounded text-center text-xs font-mono"
                                    />
                                    <button 
                                      onClick={() => handleSaveCustomThreshold(item.productId)}
                                      className="p-1 bg-emerald-500 rounded text-white hover:bg-emerald-600"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => setCustomThresholdId(null)}
                                      className="p-1 bg-slate-700 rounded text-app-text-primary hover:bg-slate-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-app-text-secondary font-bold">{item.minimumStock}</span>
                                    <button 
                                      onClick={() => {
                                        setCustomThresholdId(item.productId);
                                        setCustomThresholdVal(item.minimumStock);
                                      }}
                                      className="text-[10px] text-[#FF6A00] font-bold hover:underline"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider${
                                  item.status === 'in_stock' 
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                    : item.status === 'low_stock'
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                                    : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                }`}>
                                  {item.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => handleTriggerSaleDemo(item.productId)}
                                    className="px-2.5 py-1 bg-app-bg hover:bg-[#FF6A00]/20 hover:text-[#FF6A00] border border-app-border hover:border-[#FF6A00]/30 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                                    title="Deducts 1 unit with allocation animation"
                                  >
                                    Mock Sale
                                  </button>

                                  <Link
                                    to={`/admin/products/${item.productId}`}
                                    className="p-1.5 bg-app-bg hover:bg-slate-700 rounded border border-app-border text-app-text-secondary"
                                    title="Edit Product details in Product Studio"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>

                                  <button
                                    onClick={() => setExpandedItemId(isExpanded ? null : item.productId)}
                                    className="p-1.5 bg-app-bg hover:bg-slate-700 rounded border border-app-border text-app-text-secondary"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Audit Log Trail for this item */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={8} className="p-4 bg-[#0e101f] border-t border-b border-app-border">
                                  <div className="space-y-3 pl-12 pr-6">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[11px] font-black text-app-text-secondary uppercase tracking-widest flex items-center space-x-2">
                                        <History className="w-3.5 h-3.5 text-[#FF6A00]" />
                                        <span>Audit History for {item.productName}</span>
                                      </h4>
                                      <span className="text-[10px] text-slate-500">Showing last 5 adjustments</span>
                                    </div>

                                    {auditLog.filter(l => l.productId === item.productId).length === 0 ? (
                                      <p className="text-[11px] text-slate-500 font-mono italic">No recorded stock adjustments found for this product yet.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {auditLog.filter(l => l.productId === item.productId).slice(0, 5).map(log => (
                                          <div key={log.id} className="flex items-center justify-between bg-[#121424] p-2.5 rounded border border-app-border text-[11px] font-mono">
                                            <div className="flex items-center space-x-4">
                                              <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold${
                                                log.change > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                                              }`}>
                                                {log.change > 0 ? `+${log.change}` : log.change}
                                              </span>
                                              <span className="text-app-text-secondary font-bold capitalize">{log.reason.replace('_', ' ')}</span>
                                              <span className="text-app-text-secondary italic">"{log.notes}"</span>
                                            </div>
                                            <div className="text-slate-500">
                                              By: <span className="text-app-text-secondary font-bold">{log.actedBy}</span>
                                              {log.orderId && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-app-bg rounded text-app-text-secondary">Order: {log.orderId}</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="p-4 bg-[#16192E] border-t border-app-border flex items-center justify-between text-xs text-app-text-secondary">
                    <div>
                      Showing <span className="text-app-text-primary font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                      <span className="text-app-text-primary font-bold">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of{' '}
                      <span className="text-app-text-primary font-bold">{filteredItems.length}</span> SKUs
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-app-bg rounded hover:bg-slate-750 disabled:opacity-40 font-bold"
                      >
                        Prev
                      </button>
                      <span className="font-mono">Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 bg-app-bg rounded hover:bg-slate-750 disabled:opacity-40 font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Grid View */}
            {viewType === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                  <div key={item.productId} className="bg-[#121424] border border-app-border p-5 rounded-2xl shadow-md space-y-4 hover:border-slate-700 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-app-text-primary text-base">{item.productName}</h4>
                        <span className="text-[10px] text-slate-500 font-mono tracking-wider">{item.sku}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider${
                        item.status === 'in_stock' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : item.status === 'low_stock'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-app-card p-3 rounded-lg text-center border border-app-border">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider">Current</div>
                        <div className="text-sm font-bold text-app-text-primary mt-1 font-mono">{item.currentStock}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider">Allocated</div>
                        <div className="text-sm font-bold text-amber-500 mt-1 font-mono">{item.allocatedStock}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider">Available</div>
                        <div className="text-sm font-bold text-emerald-500 mt-1 font-mono">{item.availableStock}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-app-text-secondary font-mono">
                        <span>Min Threshold: {item.minimumStock}</span>
                        <span>Capacity Target: {item.maximumStock}</span>
                      </div>
                      <div className="h-2 w-full bg-app-bg rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r${item.availableStock > item.minimumStock ? 'from-[#FF6A00] to-emerald-500' : 'from-rose-500 to-amber-500'}`}
                          style={{ width: `${Math.min(100, (item.availableStock / (item.maximumStock || 100)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => handleTriggerSaleDemo(item.productId)}
                        className="text-[10px] font-extrabold text-[#FF6A00] uppercase tracking-wider flex items-center space-x-1 hover:underline"
                      >
                        <span>Simulate Sale</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <Link 
                        to={`/admin/products/${item.productId}`}
                        className="text-[10px] text-app-text-secondary hover:text-white font-bold"
                      >
                        Edit Catalog Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Charts View */}
            {viewType === 'chart' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Stock Level chart */}
                <div className="bg-[#121424] border border-app-border p-5 rounded-2xl shadow-md">
                  <h4 className="text-xs uppercase font-extrabold text-app-text-secondary tracking-wider mb-4">SKU Available vs Allocated Levels</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stockLevelChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#121424', borderColor: '#334155', color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="available" name="Available Stock" fill="#00C49F" />
                        <Bar dataKey="allocated" name="Allocated Pending" fill="#FFBB28" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Pie Chart */}
                <div className="bg-[#121424] border border-app-border p-5 rounded-2xl shadow-md">
                  <h4 className="text-xs uppercase font-extrabold text-app-text-secondary tracking-wider mb-4">Stock Value Distribution by Category</h4>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 2: LOW STOCK ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            
            {/* Filter bar */}
            <div className="flex items-center justify-between bg-[#121424] p-4 rounded-xl border border-app-border">
              <div className="flex items-center space-x-4">
                <span className="text-xs text-app-text-secondary">Filter Alerts:</span>
                <div className="flex space-x-1.5">
                  {(['all', 'warning', 'critical'] as const).map(sev => (
                    <button
                      key={sev}
                      onClick={() => setAlertFilter(sev)}
                      className={`px-3 py-1.5 text-[10px] font-black rounded uppercase tracking-wider transition-all${
                        alertFilter === sev ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Automated Notifications setting toggles */}
              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => {
                      setEmailAlerts(e.target.checked);
                      showToast(`Email notifications ${e.target.checked ? 'enabled' : 'disabled'}!`, 'info');
                    }}
                    className="rounded bg-app-bg border-app-border text-[#FF6A00] focus:ring-[#FF6A00]"
                  />
                  <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider flex items-center space-x-1">
                    <Mail className="w-3 h-3" />
                    <span>Email Alerts</span>
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackIntegration}
                    onChange={(e) => {
                      setSlackIntegration(e.target.checked);
                      showToast(`Slack channel integration ${e.target.checked ? 'activated' : 'deactivated'}!`, 'info');
                    }}
                    className="rounded bg-app-bg border-app-border text-[#FF6A00] focus:ring-[#FF6A00]"
                  />
                  <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider flex items-center space-x-1">
                    <Slack className="w-3 h-3" />
                    <span>Slack Sync</span>
                  </span>
                </label>
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="bg-[#121424] border border-app-border p-12 text-center rounded-xl space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-base font-extrabold text-app-text-primary">All Stock Levels Healthy</h3>
                <p className="text-xs text-app-text-secondary max-w-sm mx-auto">
                  No active low stock alerts detected. Minimum thresholds are satisfied across all SKUs. Awesome work!
                </p>
              </div>
            ) : (
              <div className="bg-[#121424] border border-app-border rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-app-border text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-[#16192E]">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">SKU / Code</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Severity</th>
                        <th className="p-4">Alert Message</th>
                        <th className="p-4">Action Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs font-mono">
                      {filteredAlerts.map(alert => {
                        const product = inventoryItems.find(i => i.productId === alert.productId);
                        return (
                          <tr key={alert.id} className={`hover:bg-slate-800/50 transition-colors${alert.acknowledged ? 'opacity-50' : ''}`}>
                            <td className="p-4 text-app-text-secondary">{new Date(alert.createdAt).toLocaleString()}</td>
                            <td className="p-4 font-bold text-app-text-secondary">{product?.sku || 'N/A'}</td>
                            <td className="p-4 font-bold capitalize text-app-text-secondary">{alert.type.replace('_', ' ')}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold${
                                alert.severity === 'critical' ? 'bg-rose-950 text-rose-400 border border-rose-500/20' : 'bg-amber-950 text-amber-400 border border-amber-500/20'
                              }`}>
                                {alert.severity}
                              </span>
                            </td>
                            <td className="p-4 text-app-text-secondary">{alert.message}</td>
                            <td className="p-4">
                              {alert.acknowledged ? (
                                <span className="text-slate-500 text-[11px] flex items-center space-x-1 font-bold">
                                  <CheckCircle className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Acknowledged</span>
                                </span>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      acknowledgeAlert(alert.id);
                                      showToast('Alert acknowledged successfully.');
                                    }}
                                    className="px-2 py-1 bg-app-bg hover:bg-slate-700 text-app-text-secondary border border-app-border rounded text-[10px] font-bold uppercase transition"
                                  >
                                    Acknowledge
                                  </button>
                                  <button
                                    onClick={() => showToast('Replenishment Purchase Order draft created!', 'info')}
                                    className="px-2 py-1 bg-[#FF6A00] hover:bg-[#E05B00] text-app-text-primary rounded text-[10px] font-bold uppercase transition"
                                  >
                                    Restock PO
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 3: STOCK ADJUSTMENTS */}
        {activeTab === 'adjustments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Manual stock adjustment form */}
            <div className="bg-[#121424] border border-app-border p-6 rounded-2xl shadow-md space-y-4">
              <h3 className="text-base font-extrabold text-app-text-primary flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-[#FF6A00]" />
                <span>Manual Stock Correction</span>
              </h3>
              <p className="text-xs text-app-text-secondary">
                Correct stock counts for physical inventory verification, damage/loss deductions, or returned item restocking.
              </p>

              <form onSubmit={handleManualAdjustSubmit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Select SKU / Product</label>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    required
                    className="w-full bg-app-card border border-app-border rounded-lg p-2 text-xs text-app-text-secondary focus:border-[#FF6A00] focus:outline-none transition"
                  >
                    <option value="">Select a product...</option>
                    {inventoryItems.map(item => (
                      <option key={item.productId} value={item.productId}>
                        {item.productName} ({item.sku} - Stock: {item.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Adjustment Type</label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as any)}
                    required
                    className="w-full bg-app-card border border-app-border rounded-lg p-2 text-xs text-app-text-secondary focus:border-[#FF6A00] focus:outline-none transition"
                  >
                    <option value="restock">Restock Inventory (+ Add)</option>
                    <option value="return">Customer Return (+ Add)</option>
                    <option value="damage_loss">Damage / Theft (- Deduct)</option>
                    <option value="manual_adjustment">Direct Physical Count Override (= Set)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Quantity</label>
                  <input
                    type="number"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                    required
                    min={1}
                    className="w-full bg-app-card border border-app-border rounded-lg p-2 text-xs text-app-text-secondary font-mono focus:border-[#FF6A00] focus:outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Adjustment Notes</label>
                  <textarea
                    placeholder="Enter reason for this correction..."
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    required
                    className="w-full bg-app-card border border-app-border rounded-lg p-2 text-xs text-app-text-secondary h-24 focus:border-[#FF6A00] focus:outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#FF6A00] hover:bg-[#E05B00] text-app-text-primary text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
                >
                  Commit Adjustment
                </button>
              </form>
            </div>

            {/* List of recent stock adjustments */}
            <div className="bg-[#121424] border border-app-border p-6 rounded-2xl shadow-md lg:col-span-2 space-y-4">
              <h3 className="text-base font-extrabold text-app-text-primary flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Recent Stock Movements & Adjustments Ledger</span>
              </h3>
              <p className="text-xs text-app-text-secondary">
                Historical record of all ledger adjustments, sales deductions, restock batches, and manual overrides made in the last 30 days.
              </p>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {auditLog.slice(0, 30).map(log => {
                  const product = inventoryItems.find(i => i.productId === log.productId);
                  return (
                    <div key={log.id} className="bg-app-card border border-app-border p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-extrabold text-app-text-primary text-[13px]">{product?.productName || 'Catalog Product'}</span>
                          <span className="text-[10px] bg-app-bg text-app-text-secondary px-1.5 py-0.5 rounded">{log.id}</span>
                        </div>
                        <div className="text-[11px] text-app-text-secondary flex items-center space-x-2 flex-wrap">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          <span>•</span>
                          <span className="font-bold uppercase tracking-wider text-indigo-400">{log.reason.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>Actor: <span className="font-bold text-app-text-secondary">{log.actedBy}</span></span>
                        </div>
                        <p className="text-[11px] text-app-text-secondary italic">Notes: "{log.notes}"</p>
                      </div>

                      <div className="text-right flex items-center sm:flex-col justify-between sm:justify-center gap-1.5">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold${
                          log.change > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {log.change > 0 ? `+${log.change}` : log.change} units
                        </span>
                        <span className="text-[10px] text-slate-500">Stock: {log.previousStock} → {log.newStock}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: AUDIT LOG & RECONCILIATION */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-6">
            
            {/* Reconciliation header explanation card */}
            <div className="bg-[#121424] border border-app-border p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-app-text-primary flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Physical Variance Reconciliation Audit Report</span>
                </h3>
                <p className="text-xs text-app-text-secondary max-w-2xl">
                  Compare recorded catalog stock with verified physical warehouse count audits. Discrepancies represent unaccounted stockout variances that require manual correction approval.
                </p>
              </div>

              <button
                onClick={() => handleExportCSV(
                  getVarianceReport(),
                  `choosify_stock_variance_reconciliation_report_${new Date().toISOString().slice(0,10)}.csv`
                )}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Export Variance Ledger</span>
              </button>
            </div>

            {/* Reconciliation variance table */}
            <div className="bg-[#121424] border border-app-border rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-app-border text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-[#16192E]">
                      <th className="p-4">Product / Variant Name</th>
                      <th className="p-4 font-mono">Recorded System Count</th>
                      <th className="p-4 font-mono">Physical Verified Count</th>
                      <th className="p-4 font-mono">Variance Discrepancy</th>
                      <th className="p-4">Variance Rating</th>
                      <th className="p-4 text-right">Corrective Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs">
                    {getVarianceReport().map((row) => (
                      <tr key={row.itemId} className="hover:bg-slate-800/50 transition">
                        <td className="p-4">
                          <div className="font-bold text-app-text-primary text-[13px]">{row.name}</div>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {row.itemId}</span>
                        </td>
                        <td className="p-4 font-mono font-bold text-app-text-secondary text-[13px]">{row.recorded} units</td>
                        <td className="p-4 font-mono font-bold text-app-text-secondary text-[13px]">{row.physical} units</td>
                        <td className="p-4 font-mono font-bold text-app-text-secondary text-[13px]">
                          {row.difference === 0 ? (
                            <span className="text-emerald-500">0 (Match)</span>
                          ) : row.difference > 0 ? (
                            <span className="text-emerald-400">+{row.difference} surplus</span>
                          ) : (
                            <span className="text-rose-400">{row.difference} deficit</span>
                          )}
                        </td>
                        <td className="p-4">
                          {row.difference === 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Balanced
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Discrepancy Detected
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {row.difference !== 0 ? (
                            <button
                              onClick={() => {
                                updateStock(row.itemId, row.physical, 'manual_adjustment', `Automatic reconciliation override to physical count`);
                                showToast(`Auto-reconciled ${row.name} to physically verified ${row.physical} units!`, 'success');
                              }}
                              className="px-3 py-1 bg-[#FF6A00] hover:bg-[#E05B00] text-app-text-primary font-bold text-[10px] uppercase rounded tracking-wider transition"
                            >
                              Sync to Physical
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-mono italic">Verified match</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
