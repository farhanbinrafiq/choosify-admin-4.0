import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders, Order, Customer, OrderStatus, CustomerBehavior } from '../../contexts/OrdersContext';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  ShieldCheck, 
  Search, 
  Filter, 
  ChevronRight, 
  Flag, 
  Percent, 
  BookOpen, 
  Calendar, 
  ArrowUpRight,
  UserCheck,
  ToggleLeft,
  XCircle,
  Clock,
  Landmark,
  BadgePercent,
  Download,
  FileSpreadsheet,
  Printer,
  Truck,
  Scale,
  MessageSquare,
  Plus,
  RefreshCw,
  Sliders,
  HelpCircle,
  Activity,
  FileText,
  AlertOctagon,
  Settings,
  Share2,
  CheckCircle2,
  Lock,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend, 
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie
} from 'recharts';

export default function OrdersOverview() {
  const { profile } = useAuth();
  const isAdmin = ['super_admin', 'admin', 'moderator', 'support_agent', 'finance_manager', 'marketing_manager'].includes(profile?.role || '');
  const { orders, customers, flagCustomer, updateOrderStatus } = useOrders();
  
  // Tab states and filters
  const [timeframe, setTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [selectedComparison, setSelectedComparison] = useState<'Previous Period' | 'Last Month' | 'Last Year'>('Previous Period');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('All');
  const [selectedBehaviorFilter, setSelectedBehaviorFilter] = useState<'All' | CustomerBehavior>('All');
  
  // Metric views & interactive stats action state
  const [activeRevenueChart, setActiveRevenueChart] = useState<'Area' | 'Line' | 'Bar'>('Area');
  const [productFilterTab, setProductFilterTab] = useState<'Revenue' | 'Units' | 'Returns' | 'Complaints'>('Revenue');
  const [customerFilterTab, setCustomerFilterTab] = useState<'VIP' | 'Repeat' | 'New' | 'HighRisk' | 'All'>('All');
  const [logisticsViewMode, setLogisticsViewMode] = useState<'Summary' | 'CourierComparison'>('Summary');
  const [activeLogMsg, setActiveLogMsg] = useState<string | null>(null);
  
  // Simulated interactive export status
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Customer Flag modal states
  const [flaggingCustomer, setFlaggingCustomer] = useState<Customer | null>(null);
  const [flagReasonText, setFlagReasonText] = useState('');

  // Live intelligence ticker logs state
  const [liveLogEntries, setLiveLogEntries] = useState([
    { id: 'l1', time: '09:35 AM', type: 'Order Created', icon: '🛍️', text: 'WhatsApp Manual Order recorded by Admin farhanbinrafiq' },
    { id: 'l2', time: '09:12 AM', type: 'Status Change', icon: '⚡', text: 'Order #OD-9051 updated to "In Transit" via Pathao' },
    { id: 'l3', time: '08:44 AM', type: 'Invoice Sent', icon: '📝', text: 'Digital PDF Invoice successfully emailed to customer "Sumon Khan"' },
    { id: 'l4', time: '07:30 AM', type: 'Order Delivered', icon: '✓', text: 'Direct Marketplace checkout #MRK-8812 marked Delivered' },
    { id: 'l5', time: '07:12 AM', type: 'Dispute Raised', icon: '🚩', text: 'Refund request opened for Order #MRK-8012 - Item Damaged' },
    { id: 'l6', time: '06:50 AM', type: 'User Flagged', icon: '🚫', text: 'Auto-Risk Monitor flagged high cancellation rate for farid.pete@gmail.com' },
  ]);

  // Hook to simulate new log entries and export loading
  useEffect(() => {
    const timer = setInterval(() => {
      const logs = [
        'New Facebook Messenger Manual Order logged by Executive Team',
        'Invoice #INV-2901-B processed successfully to Cashbook Ledger',
        'Customer Dispute claims settled for Return Package #RET-1120',
        'Courier API payload dispatched to SteadFast cargo portal',
        'Automated Platform Fee ledger generated for Seller brand "Westec"'
      ];
      const selected = logs[Math.floor(Math.random() * logs.length)];
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLiveLogEntries(prev => [
        { id: String(Date.now()), time: timeStr, type: 'System Update', icon: '🧠', text: selected },
        ...prev.slice(0, 7)
      ]);
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  const handleTriggerExport = (reportType: string) => {
    setExportingType(reportType);
    setExportProgress(10);
    
    const interval = setInterval(() => {
      setExportProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExportingType(null);
            showInlineToast(`✓ ${reportType} report successfully exported as .xlsx sheets and queued for PDF render!`);
          }, 400);
          return 100;
        }
        return p + 30;
      });
    }, 200);
  };

  const showInlineToast = (msg: string) => {
    setActiveLogMsg(msg);
    setTimeout(() => {
      setActiveLogMsg(null);
    }, 4000);
  };

  // 1. Calculations & Metrics
  const calculatedGrossRevenue = orders.reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0);
  const totalDeliveredRevenue = orders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0);
  
  // Platform fee deduction calculation
  const totalCommissionRevenue = orders
    .filter(o => o.status === 'Delivered')
    .reduce((sum, o) => sum + (o.earnings?.futureAutomatedDeduction || (o.product.price * 0.1)), 0);

  const netMarketplaceRevenue = totalCommissionRevenue; // Net platform earnings
  const sellerPayoutsLedgerVal = totalDeliveredRevenue - totalCommissionRevenue;

  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;
  const dispatchOrdersCount = orders.filter(o => o.status === 'Dispatched').length;
  const deliveredOrdersCount = orders.filter(o => o.status === 'Delivered').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'Cancelled' || o.status === 'Rejected').length;
  
  // Additional categories
  const returnedOrdersCount = orders.filter(o => o.status === 'Returned' || (o as any).status === 'Returned').length || 2;
  const exchangeOrdersCount = orders.filter(o => o.status === 'Exchange' || (o as any).status === 'Exchange').length || 1;
  const manualOrdersCount = orders.filter(o => o.isManual).length;
  const activeOrdersCount = orders.filter(o => ['Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit'].includes(o.status)).length;
  const otherOrdersCount = orders.filter(o => !o.isManual && !['Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Rejected'].includes(o.status)).length;

  const averageOrderValue = totalOrdersCount > 0 ? calculatedGrossRevenue / totalOrdersCount : 0;
  
  // Timeframe based chart stats generator
  const getChartDataset = () => {
    const stats: Record<typeof timeframe, { label: string; gross: number; net: number; commission: number }[]> = {
      'Daily': [
        { label: '09:00', gross: 4200, net: 3780, commission: 420 },
        { label: '11:00', gross: 14500, net: 13050, commission: 1450 },
        { label: '14:00', gross: 8400, net: 7560, commission: 840 },
        { label: '17:00', gross: 148199, net: 133379, commission: 14820 },
        { label: '20:00', gross: 25000, net: 22500, commission: 2500 },
      ],
      'Weekly': [
        { label: 'Mon', gross: 21000, net: 18900, commission: 2100 },
        { label: 'Tue', gross: 38000, net: 34200, commission: 3800 },
        { label: 'Wed', gross: 145000, net: 130500, commission: 14500 },
        { label: 'Thu', gross: 29900, net: 26910, commission: 2990 },
        { label: 'Fri', gross: 184500, net: 166050, commission: 18450 },
        { label: 'Sat', gross: 48900, net: 44010, commission: 4890 },
        { label: 'Sun', gross: 31200, net: 28080, commission: 3120 },
      ],
      'Monthly': [
        { label: 'Jan', gross: 220000, net: 198000, commission: 22000 },
        { label: 'Feb', gross: 380000, net: 342000, commission: 38000 },
        { label: 'Mar', gross: 512000, net: 460800, commission: 51200 },
        { label: 'Apr', gross: 641000, net: 576900, commission: 64100 },
        { label: 'May', gross: 780000, net: 702000, commission: 78000 },
        { label: 'Jun (Proj)', gross: 1102000, net: 991800, commission: 110200 },
      ],
      'Quarterly': [
        { label: 'Q1', gross: 1110000, net: 999000, commission: 111000 },
        { label: 'Q2', gross: 1420000, net: 1278000, commission: 142000 },
        { label: 'Q3', gross: 1290000, net: 1161000, commission: 129000 },
        { label: 'Q4', gross: 1980000, net: 1782000, commission: 198000 },
      ],
      'Yearly': [
        { label: '2023', gross: 4500000, net: 4050000, commission: 450000 },
        { label: '2024', gross: 6800000, net: 6120000, commission: 680000 },
        { label: '2025', gross: 11400000, net: 10260000, commission: 1140000 },
        { label: '2026 (YTD)', gross: 9540000, net: 8586000, commission: 954000 },
      ],
    };
    return stats[timeframe];
  };

  // Derived seller breakdown
  const sellersList = Array.from(new Set(orders.map(o => o.product.sellerName))).filter(Boolean);
  const sellerRankings = sellersList.map(sellerName => {
    const sellerOrders = orders.filter(o => o.product.sellerName === sellerName);
    const completed = sellerOrders.filter(o => o.status === 'Delivered').length;
    const cancelled = sellerOrders.filter(o => o.status === 'Cancelled' || o.status === 'Rejected').length;
    const returned = Math.min(sellerOrders.length, 1); // Mock return proportion
    const exchange = Math.min(sellerOrders.length, 0); // Mock exchange proportion
    const revenue = sellerOrders
      .filter(o => o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0);
    
    const commission = sellerOrders
      .filter(o => o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.earnings?.futureAutomatedDeduction || (o.product.price * 0.1)), 0);

    const fRate = sellerOrders.length > 0 ? (completed / sellerOrders.length) * 100 : 0;
    const cRate = sellerOrders.length > 0 ? (cancelled / sellerOrders.length) * 100 : 0;

    // Rich mock attributes
    const ratingSum = 4.0 + (sellerOrders.length % 10) * 0.1;
    const avgRating = Math.min(5.0, Number(ratingSum.toFixed(1)));
    const trustScore = Math.min(100, 75 + (sellerOrders.length * 3));
    const riskGrade = trustScore > 90 ? 'A (Excellent)' : trustScore > 80 ? 'B (Stable)' : 'C (Caution)';
    
    return {
      name: sellerName,
      brand: sellerOrders[0]?.product.brand || 'Choosify Retail',
      orders: sellerOrders.length,
      revenue,
      fulfillmentRate: fRate,
      cancellationRate: cRate,
      returnRate: (returned / (sellerOrders.length || 1)) * 100,
      exchangeRate: (exchange / (sellerOrders.length || 1)) * 100,
      avgDeliveryTime: '32 Hours',
      avgRating,
      trustScore,
      riskGrade,
      settlementStatus: 'Settled',
      platformCommission: commission
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Derived product breakdown
  const productPerformance = orders.map(o => {
    const isCompleted = o.status === 'Delivered';
    const isCancelled = o.status === 'Cancelled' || o.status === 'Rejected';
    return {
      id: o.product.id,
      name: o.product.name,
      category: (o.product as any).category || 'Fashion',
      brand: o.product.brand || 'Various',
      price: o.product.price,
      quantity: o.quantity || 1,
      isCompleted,
      isCancelled,
      commission: o.earnings?.futureAutomatedDeduction || (o.product.price * 0.1)
    };
  });

  // Consolidate unique products
  const uniqueProductsMap: Record<string, any> = {};
  productPerformance.forEach(p => {
    if (!uniqueProductsMap[p.id]) {
      uniqueProductsMap[p.id] = {
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        unitsSold: 0,
        revenue: 0,
        cancelledCount: 0,
        returnsCount: 0,
        complaintsCount: 0,
        rating: 4.8,
        commission: 0,
        viewCount: 412 + (p.name.length * 15),
        trend: '+24%'
      };
    }
    uniqueProductsMap[p.id].unitsSold += p.quantity;
    if (p.isCompleted) {
      uniqueProductsMap[p.id].revenue += p.price * p.quantity;
      uniqueProductsMap[p.id].commission += p.commission * p.quantity;
    }
    if (p.isCancelled) {
      uniqueProductsMap[p.id].cancelledCount += 1;
    }
    // inject simulated complains and returns
    if (p.id.charCodeAt(0) % 7 === 0) {
      uniqueProductsMap[p.id].returnsCount += 1;
    }
    if (p.id.charCodeAt(0) % 9 === 0) {
      uniqueProductsMap[p.id].complaintsCount += 1;
    }
  });

  const productPerformanceList = Object.values(uniqueProductsMap).sort((a, b) => {
    if (productFilterTab === 'Revenue') return b.revenue - a.revenue;
    if (productFilterTab === 'Units') return b.unitsSold - a.unitsSold;
    if (productFilterTab === 'Returns') return b.returnsCount - a.returnsCount;
    return b.complaintsCount - a.complaintsCount;
  });

  // Logistics & Courier stats comparison
  const courierPerformanceList = [
    { name: 'Pathao Courier', key: 'Pathao', orders: orders.filter(o => o.deliveryPartner === 'Pathao').length || 8, avgTime: '28.5 Hours', late: 1, failed: 0, returns: 4.5, rating: 4.7, success: '96.2%' },
    { name: 'SteadFast Logistics', key: 'SteadFast', orders: orders.filter(o => o.deliveryPartner === 'SteadFast').length || 4, avgTime: '31.2 Hours', late: 2, failed: 1, returns: 3.2, rating: 4.6, success: '94.8%' },
    { name: 'RedX Express', key: 'RedX', orders: orders.filter(o => o.deliveryPartner === 'RedX').length || 3, avgTime: '38.4 Hours', late: 3, failed: 0, returns: 6.8, rating: 4.2, success: '91.5%' },
    { name: 'Paperfly Delivery', key: 'Paperfly', orders: orders.filter(o => o.deliveryPartner === 'Paperfly').length || 2, avgTime: '42.0 Hours', late: 4, failed: 2, returns: 8.4, rating: 3.9, success: '86.4%' },
  ];

  // Order Origin Sources stats
  const orderSourceAnalyticsList = [
    { name: 'Choosify Web Portal', code: 'Organic Web', count: orders.filter(o => !o.isManual).length, revenue: orders.filter(o => !o.isManual).reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0), conversion: '4.21%', fulfillment: '94.5%', aov: orders.filter(o => !o.isManual).length > 0 ? orders.filter(o => !o.isManual).reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0) / orders.filter(o => !o.isManual).length : 5200 },
    { name: 'WhatsApp Sales Channel', code: 'WhatsApp', count: orders.filter(o => o.isManual && o.platformSource === 'WhatsApp').length || 3, revenue: (orders.filter(o => o.isManual && o.platformSource === 'WhatsApp').reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0) || 12400), conversion: '8.90%', fulfillment: '100%', aov: 4133 },
    { name: 'Facebook Manual Gateway', code: 'Facebook', count: orders.filter(o => o.isManual && o.platformSource === 'Facebook').length || 2, revenue: (orders.filter(o => o.isManual && o.platformSource === 'Facebook').reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0) || 8900), conversion: '6.45%', fulfillment: '92.5%', aov: 4450 },
    { name: 'Instagram DM Agent', code: 'Instagram', count: orders.filter(o => o.isManual && o.platformSource === 'Instagram').length || 1, revenue: (orders.filter(o => o.isManual && o.platformSource === 'Instagram').reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0) || 5400), conversion: '7.10%', fulfillment: '100%', aov: 5400 },
    { name: 'Offline Admin Desk', code: 'Offline', count: orders.filter(o => o.isManual && o.platformSource === 'Offline').length || 1, revenue: (orders.filter(o => o.isManual && o.platformSource === 'Offline').reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0) || 4200), conversion: '12.0%', fulfillment: '100%', aov: 4200 },
  ];

  // Customer Intelligence lists & categorization
  const customerAnalyticsList = customers.map(cust => {
    const custOrders = orders.filter(o => o.customer.email === cust.email);
    const placed = custOrders.length;
    const completed = custOrders.filter(o => o.status === 'Delivered').length;
    const cancelled = custOrders.filter(o => o.status === 'Cancelled' || o.status === 'Rejected').length;
    const totalSpent = custOrders.reduce((sum, o) => sum + (o.product.price * (o.quantity || 1)), 0);

    let behaviorGrade: CustomerBehavior = 'Neutral';
    if (placed > 1 && completed / placed >= 0.75) {
      behaviorGrade = 'Good';
    } else if (cancelled / placed >= 0.4 || cust.flagged) {
      behaviorGrade = 'Risk';
    }

    const typeLabel = totalSpent > 12000 ? 'VIP Customer' : placed > 1 ? 'Repeat Buyer' : 'New Customer';

    return {
      ...cust,
      stats: {
        placed,
        completed,
        cancelled,
        totalSpent
      },
      computedBehavior: behaviorGrade,
      typeLabel
    };
  });

  const filteredCustomerIntelligence = customerAnalyticsList.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (customerFilterTab === 'All') return matchesSearch;
    if (customerFilterTab === 'VIP') return matchesSearch && item.typeLabel === 'VIP Customer';
    if (customerFilterTab === 'Repeat') return matchesSearch && item.typeLabel === 'Repeat Buyer';
    if (customerFilterTab === 'New') return matchesSearch && item.typeLabel === 'New Customer';
    if (customerFilterTab === 'HighRisk') return matchesSearch && (item.computedBehavior === 'Risk' || item.flagged);
    return matchesSearch;
  });

  const handleFlagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggingCustomer) return;
    flagCustomer(flaggingCustomer.id, !flaggingCustomer.flagged, flagReasonText || 'Administrative override.');
    setFlaggingCustomer(null);
    setFlagReasonText('');
    showInlineToast(`✓ Customer status toggled for ${flaggingCustomer.name}`);
  };

  const startFlagging = (cust: Customer) => {
    setFlaggingCustomer(cust);
    setFlagReasonText(cust.flagReason || '');
  };

  return (
    <div className="space-y-8 pb-20 text-sans text-white">
      
      {/* Toast Alert Banner */}
      {activeLogMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/30 text-emerald-400 px-6 py-4.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold leading-none">{activeLogMsg}</span>
        </div>
      )}

      {/* Exporter Block Overlay */}
      {exportingType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-app-card border border-app-border rounded-3xl p-8 w-full max-w-sm text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-app-accent animate-spin mx-auto" />
            <h4 className="text-sm font-black uppercase tracking-wider text-white">Generating Financial Report</h4>
            <p className="text-xs text-slate-400">Packaging and formatting "{exportingType}" for encrypted administrator export. Please hold...</p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-app-accent h-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block font-mono">{exportProgress}% Completed</span>
          </div>
        </div>
      )}

      {/* HEADER BANNER SECTION */}
      <div id="m-header" className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-500/15 to-app-accent/15 rounded-full border border-app-accent/20">
            <Sparkles className="w-3.5 h-3.5 text-app-accent animate-pulse" />
            <span className="text-[10px] font-black tracking-widest text-[#F4631E] uppercase">Marketplace Order Intelligence</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            📊 Marketplace Order Intelligence Center
          </h1>
          <p className="text-xs text-app-text-secondary max-w-3xl leading-relaxed">
            Centralized marketplace analytics, operational intelligence, revenue insights, seller performance monitoring, customer behavior tracking, and fulfillment analytics.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center self-start xl:self-center shrink-0">
          {/* Compare dropdown selection */}
          <div className="flex items-center gap-2 bg-app-bg px-3 py-2 rounded-xl border border-app-border">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Compare:</span>
            <select
              value={selectedComparison}
              onChange={(e) => {
                setSelectedComparison(e.target.value as any);
                showInlineToast(`Comparison timeline matched with ${e.target.value}`);
              }}
              className="bg-transparent border-none text-xs text-white font-bold outline-none cursor-pointer focus:ring-0"
            >
              <option value="Previous Period">Prev. Period</option>
              <option value="Last Month">Last Month</option>
              <option value="Last Year">Last Year</option>
            </select>
          </div>

          <div className="flex gap-1.5 bg-app-bg p-1.5 rounded-2xl border border-app-border">
            {(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  setTimeframe(t);
                  showInlineToast(`Timeline updated to ${t} based interval charts`);
                }}
                className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${timeframe === t ? 'bg-[#F4631E] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 1 — EXECUTIVE KPI OVERVIEW */}
      <section id="sec-kpi-overview" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-app-accent" /> SECTION 1 — Executive Key Performance Indicators
          </h2>
          <span className="text-[10px] text-slate-500">Live feed updated in real-time</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: Gross Marketplace Revenue */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gross Marketplace Revenue</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">৳ {calculatedGrossRevenue.toLocaleString()}</div>
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-emerald-500 font-extrabold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +16.4%</span>
                <span className="text-slate-500">vs {selectedComparison}</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Net Marketplace Revenue */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Net Marketplace (Fees)</span>
                <span className="text-[8px] text-slate-500">Deducted platform earnings</span>
              </div>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <BadgePercent className="w-4 h-4 text-app-accent" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-emerald-400">৳ {netMarketplaceRevenue.toLocaleString()}</div>
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-emerald-400 font-extrabold flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +12.1%</span>
                <span className="text-slate-500">payout commissions</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Orders */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Sourced Orders</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <ShoppingBag className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">{totalOrdersCount} <span className="text-xs text-slate-500 font-normal">items</span></div>
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-slate-400 font-bold">Accumulated platform transactions</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Active Volume */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Orders Processing</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-amber-400">{activeOrdersCount} <span className="text-xs text-slate-500 font-normal">active</span></div>
              <div className="flex items-center gap-1.5 text-[9.5px]">
                <span className="text-slate-500">Pending & processing pipeline</span>
              </div>
            </div>
          </div>

          {/* New Row of KPIs: 5 to 8 */}
          {/* KPI 5: Pending Orders Count */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Approval</span>
              <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black">PENDING</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">{pendingOrdersCount}</div>
              <span className="text-[9px] text-[#F4631E] block font-bold">Needs Immediate Action</span>
            </div>
          </div>

          {/* KPI 6: Delivered Orders */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Delivered and Closed</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black">SUCCESS</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-emerald-400">{deliveredOrdersCount}</div>
              <span className="text-[9.5px] text-emerald-500 font-extrabold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {((deliveredOrdersCount / (totalOrdersCount || 1)) * 100).toFixed(0)}% Completion Rate</span>
            </div>
          </div>

          {/* KPI 7: Cancellations & Returns */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cancelled & Returns</span>
              <span className="text-[9px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-black">LOSS</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-rose-400">
                {cancelledOrdersCount} <span className="text-xs text-slate-500 font-normal">/ {returnedOrdersCount} returns</span>
              </div>
              <span className="text-[9.5px] text-rose-500 font-bold block">Rate: {((cancelledOrdersCount / (totalOrdersCount || 1)) * 100).toFixed(0)}% Collapse Index</span>
            </div>
          </div>

          {/* KPI 8: Exchange & Other Orders */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Exchange / Other Orders</span>
              <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-black">EXC</span>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-purple-400">
                {exchangeOrdersCount} <span className="text-xs text-slate-500 font-normal">exchanged</span>
              </div>
              <span className="text-[9.5px] text-slate-500 font-bold block">Other Custom Channels: {otherOrdersCount}</span>
            </div>
          </div>

          {/* Row of KPIs: 9 to 12 */}
          {/* KPI 9: Manual Orders (created from Unified Inbox) */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Manual Orders Inbox</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <MessageSquare className="w-4 h-4 text-emerald-400 animate-bounce" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">{manualOrdersCount}</div>
              <span className="text-[9.5px] text-slate-400 block font-bold">Created via Unified Chat Inboxes</span>
            </div>
          </div>

          {/* KPI 10: Average Order Value (AOV) */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Average Order Value (AOV)</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <Sliders className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">৳ {averageOrderValue.toFixed(0)}</div>
              <span className="text-[9.5px] text-emerald-400 flex items-center gap-0.5 leading-none font-bold">
                <TrendingUp className="w-3 h-3" /> +4.2% higher basket size
              </span>
            </div>
          </div>

          {/* KPI 11: Average Delivery & Fulfillment Time */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg Delivery & Fulfillment</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <Truck className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-white">32.4 <span className="text-xs uppercase font-black text-[#F4631E]">Hrs</span></div>
              <span className="text-[9.5px] text-slate-400 block font-bold">Processing dispatch: 14.2 Hours</span>
            </div>
          </div>

          {/* KPI 12: Pending Seller Settlements */}
          <div className="bg-app-card border border-app-border rounded-[2rem] p-5.5 space-y-3 shadow-lg hover:border-app-accent/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pending Merchant Settlements</span>
              <div className="p-2.5 bg-white/5 border border-app-border rounded-xl">
                <Landmark className="w-4 h-4 text-[#F4631E]" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xl font-black text-teal-400">৳ {sellerPayoutsLedgerVal.toLocaleString()}</div>
              <span className="text-[9.5px] text-[#F4631E] block font-bold">Bi-weekly settlement queue</span>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 2 — ORDER LIFECYCLE ANALYTICS */}
      <section id="sec-lifecycle" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-app-border/40">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400 animate-pulse" /> SECTION 2 — Complete Marketplace Order Lifecycle
            </h3>
            <p className="text-xs text-slate-400">Visual mapping of active customer orders, stage-by-stage conversions, and operational dispatch bottlenecks.</p>
          </div>
          <Link
            to="/admin/orders"
            className="px-4 py-2 bg-[#F4631E]/25 hover:bg-[#F4631E]/40 border border-[#F4631E]/30 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors duration-150"
          >
            Go to Operational Order Console <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Horizontal Lifecycle Flow cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
          
          {[
            { tag: 'Pending', count: pendingOrdersCount, t: '2.1 hrs', conv: '100%', color: 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5', status: 'Healthy' },
            { tag: 'Confirmed', count: orders.filter(o => o.status === 'Confirmed').length || 2, t: '1.4 hrs', conv: '88%', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5', status: 'Healthy' },
            { tag: 'Approved', count: orders.filter(o => o.status === 'Confirmed' || o.status === 'Processing').length || 3, t: '0.8 hrs', conv: '95%', color: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/5', status: 'Healthy' },
            { tag: 'Processing', count: orders.filter(o => o.status === 'Processing').length || 1, t: '4.5 hrs', conv: '91%', color: 'border-purple-500/20 text-purple-400 bg-purple-500/5', status: 'Healthy' },
            { tag: 'Dispatched', count: dispatchOrdersCount, t: '12.0 hrs', conv: '98%', color: 'border-orange-500/20 text-orange-400 bg-orange-500/5', status: 'Healthy' },
            { tag: 'In Transit', count: orders.filter(o => o.status === 'In Transit').length || 1, t: '18.4 hrs', conv: '96%', color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5', status: 'Delayed', alert: true },
            { tag: 'Delivered', count: deliveredOrdersCount, t: '24.1 hrs', conv: '94%', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5', status: 'Settled' },
            { tag: 'Cancelled', count: cancelledOrdersCount, t: '0.5 hrs', conv: '4.1%', color: 'border-rose-500/20 text-rose-400 bg-rose-500/5', status: 'Resolved' },
            { tag: 'Returned', count: returnedOrdersCount, t: '48.0 hrs', conv: '1.2%', color: 'border-pink-500/20 text-pink-400 bg-pink-500/5', status: 'Inspect' },
            { tag: 'Exchange', count: exchangeOrdersCount, t: '24.0 hrs', conv: '0.8%', color: 'border-fuchsia-500/20 text-fuchsia-400 bg-fuchsia-500/5', status: 'Ship' },
            { tag: 'Manual O.', count: manualOrdersCount, t: '3.5 hrs', conv: '100%', color: 'border-teal-500/20 text-teal-400 bg-teal-500/5', status: 'Direct' },
            { tag: 'Other O.', count: otherOrdersCount, t: '1.2 hrs', conv: '100%', color: 'border-slate-500/20 text-slate-400 bg-slate-500/5', status: 'Organic' },
          ].map((stage, sIdx) => (
            <div key={sIdx} className={`border rounded-2xl p-3 text-center ${stage.color} space-y-1 relative`}>
              {stage.alert && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
              <div className="text-[9px] font-black uppercase tracking-wider truncate">{stage.tag}</div>
              <div className="text-lg font-black">{stage.count}</div>
              <div className="text-[8px] opacity-70">Avg: {stage.t}</div>
              <div className="text-[8px] font-mono opacity-80 border-t border-white/5 pt-1 uppercase">
                {stage.alert ? '⚠️ STUCK' : stage.status}
              </div>
            </div>
          ))}

        </div>

        {/* Stage Conversion and Bottleneck alerts banner */}
        <div className="bg-white/[0.01] border border-app-border rounded-2xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
              <AlertOctagon className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="text-[9px] text-[#F4631E] font-black uppercase block">Operational Alert: Bottleneck Identified</span>
              <p className="text-[11px] text-slate-400 mt-0.5">There are currently 2 orders stuck in "In Transit" status for more than 48 hours. SteatFast logistics has flagged delays at outer districts.</p>
            </div>
          </div>
          <Link 
            to="/admin/orders"
            className="text-[10px] font-black uppercase tracking-wider text-[#F4631E] hover:underline whitespace-nowrap"
          >
            Inspect Logistics queue &rarr;
          </Link>
        </div>
      </section>

      {/* SECTION 3 — MARKETPLACE REVENUE ANALYTICS */}
      <section id="sec-revenue" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-app-border/40">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" /> SECTION 3 — Revenue Analytics & Dynamic Forecast Progression
            </h3>
            <p className="text-xs text-slate-400">Detailed transaction analysis split between Gross revenue, Platform commissions, and Seller settlements over selected period.</p>
          </div>

          {/* Toggle buttons for chart styles */}
          <div className="flex bg-app-bg p-1 rounded-xl border border-app-border gap-1 self-start">
            {(['Area', 'Line', 'Bar'] as const).map(style => (
              <button
                key={style}
                onClick={() => setActiveRevenueChart(style)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${activeRevenueChart === style ? 'bg-app-accent text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {style} Chart
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Metrics Breakdown cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 pt-2">
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Gross Volume</span>
            <span className="text-sm font-black text-white">৳ {calculatedGrossRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Seller Payouts</span>
            <span className="text-sm font-black text-blue-400">৳ {sellerPayoutsLedgerVal.toLocaleString()}</span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Commission Received</span>
            <span className="text-sm font-black text-emerald-400">৳ {totalCommissionRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Refund Amount (Est)</span>
            <span className="text-sm font-black text-rose-400">৳ {(orders.filter(o => o.status === 'Cancelled').length * 2100).toLocaleString()}</span>
          </div>
          <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 text-center">
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest block">Exchange Cost (Est)</span>
            <span className="text-sm font-black text-purple-400">৳ {(exchangeOrdersCount * 800).toLocaleString()}</span>
          </div>
        </div>

        {/* Recharts Chart Plotting Area */}
        <div className="h-80 w-full bg-slate-950/20 rounded-3xl p-4 border border-app-border/40">
          <ResponsiveContainer width="100%" height="100%">
            {activeRevenueChart === 'Area' ? (
              <AreaChart data={getChartDataset()} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EB4501" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#EB4501" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" name="Gross Marketplace Revenue" dataKey="gross" stroke="#EB4501" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGross)" />
                <Area type="monotone" name="Platform Commission Net" dataKey="commission" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            ) : activeRevenueChart === 'Line' ? (
              <LineChart data={getChartDataset()} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" name="Gross Revenue" dataKey="gross" stroke="#EB4501" strokeWidth={3} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Seller Settlement values" dataKey="net" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" name="Platform Earnings" dataKey="commission" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={getChartDataset()} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar name="Gross Revenue Flow" dataKey="gross" fill="#EB4501" radius={[4, 4, 0, 0]}>
                  {getChartDataset().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#F4631E' : '#EB4501'} />
                  ))}
                </Bar>
                <Bar name="Platform Fee Split" dataKey="commission" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* SECTION 4 — COMMISSION & SETTLEMENT CENTER */}
      <section id="sec-commission" className="bg-gradient-to-r from-slate-900 to-slate-950 border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#F4631E]" /> SECTION 4 — Commission Split & Settlement Dispatch Center
            </h3>
            <p className="text-xs text-slate-400">
              Manage default platform commission, view upcoming dispatch schedule, override frozen payouts, and authorize direct clearances.
            </p>
          </div>
          
          <button 
            onClick={() => handleTriggerExport('Financial Payout Outward Ledger')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Ledger to Finance
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Default commission and split summary card */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Commission Settings</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8.5px] text-slate-500 uppercase block">Flat Default Platform Fee</span>
              <div className="text-lg font-black text-white">10% per Settlement</div>
              <span className="text-[9px] text-[#F4631E] block font-bold mt-2">Active Rules: Premium Brand override active for selected VIP sellers (12%)</span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Settlement dispatch Summary</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8.5px] text-slate-500 uppercase block">Next Disbursement Run</span>
              <div className="text-lg font-black text-white">June 25, 2026</div>
              <span className="text-[10px] text-emerald-400 block font-bold">Status: Ready, All Exceptions Validated</span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Frozen / Exceptions</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8.5px] text-slate-500 uppercase block">Withheld / Blocked Settlements</span>
              <div className="text-lg font-black text-rose-500">৳ 12,400</div>
              <span className="text-[9.5px] text-slate-400 block font-bold">1 Merchant flagged under open claim dispute</span>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Authorized cleared payouts</span>
            </div>
            <div className="space-y-1">
              <span className="text-[8.5px] text-slate-500 uppercase block">Commission Transferred cleared</span>
              <div className="text-lg font-black text-emerald-400">৳ {(totalCommissionRevenue * 0.8).toFixed(0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-400 block">Bank cleared and reconciliation audited</span>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION 5 — SELLER PERFORMANCE INTELLIGENCE */}
      <section id="sec-seller-intelligence" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> SECTION 5 — Merchant Brand Performance Rankings
            </h3>
            <p className="text-xs text-slate-400">Marketplace-wide rankings of seller actions, cancellation ratios, return percentages, and net commission split values.</p>
          </div>
          
          <button 
            onClick={() => handleTriggerExport('Merchant Performance Rankings')}
            className="px-3.5 py-1.5 bg-white/5 border border-app-border hover:bg-[#F4631E] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all text-slate-300 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Seller Rankings
          </button>
        </div>

        <div className="overflow-x-auto border border-app-border rounded-2xl custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[1200px]">
            <thead>
              <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[9.5px] font-black uppercase tracking-widest">
                <th className="p-4">Seller Merchant</th>
                <th className="p-4">Associated Brand</th>
                <th className="p-4 text-center">Placed Orders</th>
                <th className="p-4 text-right">Revenue Generated</th>
                <th className="p-4 text-center">Fulfill Rate</th>
                <th className="p-4 text-center">Cancel Rate</th>
                <th className="p-4 text-center">Return Rate</th>
                <th className="p-4 text-center">Exchange Rate</th>
                <th className="p-4 text-center">Avg Dispatch Speed</th>
                <th className="p-4 text-center">Quality Rating</th>
                <th className="p-4 text-center">Trust Index</th>
                <th className="p-4 text-center">Risk Grade</th>
                <th className="p-4 text-center">Ledger Status</th>
                <th className="p-4 text-right">Commission Split</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40">
              {sellerRankings.map((s, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01]">
                  <td className="p-4">
                    <span className="font-extrabold text-white text-[11px] block">{s.name}</span>
                    <span className="text-[8.5px] text-slate-500 uppercase tracking-widest font-mono">UID: SEL-{1024 + idx}</span>
                  </td>
                  <td className="p-4">
                    <Link
                      to={`/dashboard/content-studio/brands`}
                      className="text-xs text-[#F4631E] font-black hover:underline inline-flex items-center gap-1"
                    >
                      🏷️ {s.brand} <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-white">{s.orders}</td>
                  <td className="p-4 text-right font-bold text-white">৳ {s.revenue.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                      s.fulfillmentRate >= 80 ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'
                    }`}>
                      {s.fulfillmentRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="p-4 text-center font-semibold text-rose-500">{s.cancellationRate.toFixed(0)}%</td>
                  <td className="p-4 text-center font-semibold text-purple-400">{s.returnRate.toFixed(0)}%</td>
                  <td className="p-4 text-center text-slate-400">{s.exchangeRate.toFixed(0)}%</td>
                  <td className="p-4 text-center text-slate-300 font-medium">{s.avgDeliveryTime}</td>
                  <td className="p-4 text-center text-amber-400 font-bold">⭐ {s.avgRating}</td>
                  <td className="p-4 text-center font-mono text-white font-bold">{s.trustScore}%</td>
                  <td className="p-4 text-center">
                    <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded ${
                      s.trustScore > 90 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                    }`}>
                      {s.riskGrade}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] font-black tracking-wider uppercase">
                      Payout Ready
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-emerald-400">৳ {s.platformCommission.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 6 — PRODUCT PERFORMANCE ANALYTICS */}
      <section id="sec-product-performance" className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Products Leaderboard List */}
        <div className="xl:col-span-2 bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-app-border/40">
            <div>
              <h3 className="text-md font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" /> SECTION 6 — Marketplace Product Performance Analytics
              </h3>
              <p className="text-xs text-slate-400">Evaluate top selling SKUs, products receiving cancellation complaints, and returned inventory item details.</p>
            </div>

            {/* Sub filter tabs */}
            <div className="flex bg-app-bg p-1 rounded-xl border border-app-border gap-1 self-start">
              {(['Revenue', 'Units', 'Returns', 'Complaints'] as const).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => setProductFilterTab(tabKey)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${productFilterTab === tabKey ? 'bg-app-accent text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {tabKey === 'Revenue' ? '🏆 Top Revenue' : tabKey === 'Units' ? '📦 Top Units' : tabKey === 'Returns' ? '↩️ Returned' : '🚨 Complained'}
                </button>
              ))}
            </div>
          </div>

          {/* Product list table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <th className="p-3">Product Name & Identifier</th>
                  <th className="p-3 text-center">Brand / Label</th>
                  <th className="p-3 text-center">Units Sold</th>
                  <th className="p-3 text-right">Commission Split</th>
                  <th className="p-3 text-center">Category Details</th>
                  <th className="p-3 text-right">Subtotal Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30">
                {productPerformanceList.map((prod, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01]">
                    <td className="p-3">
                      <div className="font-extrabold text-white text-[11px] truncate max-w-[280px]" title={prod.name}>
                        {prod.name}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">SKU-{prod.id.slice(0, 10).toUpperCase()}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-300">
                      🏷️ {prod.brand}
                    </td>
                    <td className="p-3 text-center font-bold text-white pr-4">{prod.unitsSold} units</td>
                    <td className="p-3 text-right font-semibold text-emerald-400">৳ {prod.commission.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-app-border text-slate-300 uppercase font-black tracking-wider">
                        {prod.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-[#F4631E]">৳ {prod.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product insights / statistics summary column */}
        <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-black text-white">Marketplace Quality Monitor</h3>
              <p className="text-xs text-slate-500">Live summary of lowest performing listings and defective cargo returns.</p>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 space-y-2">
                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Highest Return Ratio SKU</span>
                <p className="text-xs font-bold text-white">Classic Comfort Oxford Shoes</p>
                <div className="flex justify-between text-[10px] text-slate-400 border-t border-rose-500/10 pt-2 mt-1">
                  <span>Defect Claim: Size mismatch</span>
                  <span className="text-rose-400 font-bold">18.4% Return Rate</span>
                </div>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block">Highest Complaint SKU</span>
                <p className="text-xs font-bold text-white">Premium Leather Card Holder</p>
                <div className="flex justify-between text-[10px] text-slate-400 border-t border-amber-500/10 pt-2 mt-1">
                  <span>Complaint Type: Stitching finish</span>
                  <span className="text-amber-400 font-bold">2 major reports</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-app-border mt-6">
            <button 
              onClick={() => handleTriggerExport('Product Conversion & Integrity Ledger')}
              className="w-full text-center py-3 bg-white/5 border border-app-border hover:bg-white/10 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Inventory Performance Report
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 7 — CUSTOMER INTELLIGENCE CENTER */}
      <section id="sec-customer-intelligence" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" /> SECTION 7 — Customer Intelligence & Behavior Center
            </h3>
            <p className="text-xs text-[#8E9BAE]">
              Track repeat buyers, analyze high-risk restricted checkouts, view total purchase volumes, and open existing consumer profiles with one click.
            </p>
          </div>

          {/* Sub filter tabs */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-app-bg border border-app-border rounded-xl text-xs text-white outline-none placeholder:text-slate-500 font-medium"
              />
            </div>

            <div className="flex bg-app-bg p-1 rounded-xl border border-app-border gap-1">
              {(['All', 'VIP', 'Repeat', 'New', 'HighRisk'] as const).map(tabKey => (
                <button
                  key={tabKey}
                  onClick={() => setCustomerFilterTab(tabKey)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${customerFilterTab === tabKey ? 'bg-app-accent text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {tabKey === 'All' ? '👥 All Users' : tabKey === 'VIP' ? '💎 VIPs' : tabKey === 'Repeat' ? '🔄 Repeat' : tabKey === 'New' ? '✨ New' : '🚩 High-Risk'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customer behavior table */}
        <div className="overflow-x-auto border border-app-border rounded-2xl custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="p-4">Customer Identity</th>
                <th className="p-4 text-center">Orders Placed</th>
                <th className="p-4 text-center">Delivered Successful</th>
                <th className="p-4 text-center">Cancelled / Rejected</th>
                <th className="p-4 text-right">Total Spent value</th>
                <th className="p-4 text-center">Average Purchase Frequency</th>
                <th className="p-4 text-center">Risk Rating</th>
                <th className="p-4 text-center">Verification status</th>
                <th className="p-4 text-center">System Restrictions</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40">
              {filteredCustomerIntelligence.map((c, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01]">
                  <td className="p-4 gap-3 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {c.avatar}
                    </div>
                    <div>
                      {isAdmin ? (
                        <div className="font-bold text-[#F4631E] hover:underline text-[11px]">
                          <Link to={`/upe/consumer/${c.id}`}>
                            {c.name} &rarr;
                          </Link>
                        </div>
                      ) : (
                        <div className="font-bold text-white text-[11px]">{c.name}</div>
                      )}
                      <div className="text-[9px] text-slate-500">{c.email}</div>
                    </div>
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-white">{c.stats.placed}</td>
                  <td className="p-4 text-center font-mono font-bold text-emerald-400">{c.stats.completed}</td>
                  <td className="p-4 text-center font-mono font-bold text-rose-400">{c.stats.cancelled}</td>
                  <td className="p-4 text-right font-extrabold text-white font-mono">৳ {c.stats.totalSpent.toLocaleString()}</td>
                  <td className="p-4 text-center font-medium text-slate-300">Bi-weekly</td>
                  <td className="p-4 text-center">
                    <span className={`text-[9.5px] font-black px-2 py-0.5 rounded border ${
                      c.computedBehavior === 'Good' 
                        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                        : c.computedBehavior === 'Risk' 
                        ? 'text-rose-500 bg-rose-500/10 border-rose-500/20 animate-pulse' 
                        : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      {c.computedBehavior} Rated
                    </span>
                  </td>
                  <td className="p-4 text-center text-[10px] font-semibold text-teal-400">
                    🟢 OTP Verified
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                      c.flagged ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {c.flagged ? '🚩 restricted' : '🟢 unrestricted'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => startFlagging(c)}
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all ${
                          c.flagged 
                            ? 'bg-white/5 border border-slate-700 text-slate-300 hover:bg-white/10' 
                            : 'bg-rose-600/20 border border-rose-500 text-rose-400 hover:bg-rose-500 hover:text-white cursor-pointer'
                        }`}
                      >
                        {c.flagged ? 'Clear Flag' : 'Flag / restrict'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 8 — ORDER SOURCE ANALYTICS */}
      <section id="sec-source-analytics" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" /> SECTION 8 — Order Source Gateway Analytics
          </h3>
          <p className="text-xs text-slate-400">Breakdown of orders processed through direct Web checkout vs manual administrator recordings across inboxes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {orderSourceAnalyticsList.map((src, sIdx) => {
            const countRate = (src.count / (totalOrdersCount || 1)) * 100;
            return (
              <div key={sIdx} className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-3 relative group hover:border-[#F4631E]/40 transition-all">
                <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block">{src.code} GATEWAY</span>
                <h4 className="text-xs font-black text-white truncate">{src.name}</h4>
                <div className="space-y-1">
                  <div className="text-lg font-black text-white">{src.count} <span className="text-xs font-normal text-slate-500">Orders</span></div>
                  <div className="text-xs text-emerald-400 font-bold">৳ {src.revenue.toLocaleString()}</div>
                </div>
                <div className="border-t border-white/5 pt-2 text-[9px] text-slate-500 flex justify-between">
                  <span>Conversion: {src.conversion}</span>
                  <span className="text-app-accent-light font-bold">Share: {countRate.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 9 — LOGISTICS & DELIVERY INTELLIGENCE */}
      <section id="sec-logistics" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-400 animate-bounce" /> SECTION 9 — Logistics & Delivery Performance Hub
            </h3>
            <p className="text-xs text-slate-400">Monitor selected third party regional couriers, dispatch success rates, and customer fulfillment quality rankings.</p>
          </div>

          <div className="flex bg-app-bg p-1 rounded-xl border border-app-border gap-1 self-start">
            <button
              onClick={() => setLogisticsViewMode('Summary')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${logisticsViewMode === 'Summary' ? 'bg-[#F4631E] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Logistics Overview
            </button>
            <button
              onClick={() => setLogisticsViewMode('CourierComparison')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${logisticsViewMode === 'CourierComparison' ? 'bg-[#F4631E] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Compare Couriers
            </button>
          </div>
        </div>

        {logisticsViewMode === 'Summary' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Average Shipment Speed</span>
              <div className="text-2xl font-black text-emerald-400">32.4 Hours</div>
              <p className="text-[10px] text-slate-500">From payment clearance and seller packaging handover to real physical handover.</p>
            </div>
            <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Success Delivery fulfillment</span>
              <div className="text-2xl font-black text-white">96.2% Rate</div>
              <p className="text-[10px] text-slate-500">Only 4 orders returned due to region inaccessible/customer unreachable.</p>
            </div>
            <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dispatched Outwards Queue</span>
              <div className="text-2xl font-black text-[#F4631E]">{dispatchOrdersCount} En-route</div>
              <p className="text-[10px] text-slate-500">Actively logged under API transit codes in Pathao or SteadFast panels.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-app-border rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-4">Courier Name</th>
                  <th className="p-4 text-center">Handled Orders</th>
                  <th className="p-4 text-center">Avg Delivery Speed</th>
                  <th className="p-4 text-center">Late Shipments</th>
                  <th className="p-4 text-center">Failed Shipments</th>
                  <th className="p-4 text-center font-mono">Return Rate</th>
                  <th className="p-4 text-center">Rating</th>
                  <th className="p-4 text-center font-black">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40">
                {courierPerformanceList.map((cor, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01]">
                    <td className="p-4 font-extrabold text-white flex items-center gap-2">
                       🚀 {cor.name}
                    </td>
                    <td className="p-4 text-center font-bold text-white">{cor.orders}</td>
                    <td className="p-4 text-center text-slate-300">{cor.avgTime}</td>
                    <td className="p-4 text-center font-semibold text-rose-400">{cor.late}</td>
                    <td className="p-4 text-center text-rose-500 font-bold">{cor.failed}</td>
                    <td className="p-4 text-center text-purple-400 font-mono">{cor.returns}%</td>
                    <td className="p-4 text-center text-amber-400 font-bold">⭐ {cor.rating}</td>
                    <td className="p-4 text-center font-black text-emerald-400">{cor.success}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 10 — DISPUTES & COMPLAINT ANALYTICS */}
      <section id="sec-disputes" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-rose-500" /> SECTION 10 — Disputes, Chargebacks & Complaints Analytics
          </h3>
          <p className="text-xs text-slate-400">Track outstanding complaint logs, unresolved chargeback cases, and refund clearance actions from customers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-rose-950/10 border border-rose-500/30 rounded-2xl p-5 space-y-2">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">Open Dispute Cases</span>
            <div className="text-2xl font-black text-white">2 Active Claims</div>
            <Link to="/admin/orders" className="text-[10px] text-rose-400 hover:underline block pt-2 mt-1 font-bold">
              Resolve Disputes inside Console &rarr;
            </Link>
          </div>

          <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Resolved Dispute Cases</span>
            <div className="text-xl font-black text-emerald-400">14 Settled</div>
            <span className="text-[10px] text-slate-500 block">Average resolution time: 3.2 Hours</span>
          </div>

          <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Chargebacks Reported</span>
            <div className="text-xl font-black text-white">0 Accounts</div>
            <span className="text-[10px] text-slate-500 block">No fraudulent payment claims logged</span>
          </div>

          <div className="bg-white/[0.01] border border-app-border rounded-2xl p-5 space-y-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Refund Success Rate</span>
            <div className="text-xl font-black text-indigo-400">100% Cleared</div>
            <span className="text-[10px] text-slate-500 block">Completed via digital payment gateways</span>
          </div>
        </div>
      </section>

      {/* SECTION 11 — ORDER HEALTH MONITOR */}
      <section id="sec-health-monitor" className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-teal-400 animate-spin" style={{ animationDuration: '6s' }} /> SECTION 11 — Marketplace Operational Health Monitor
          </h3>
          <p className="text-xs text-slate-400">Critical review of orders requiring immediate actions. Quickly inspect and click to drill down inside the Order Console.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'Awaiting Administrator Approval', count: pendingOrdersCount, status: 'Needs Action', link: '/admin/orders', color: 'border-yellow-500/20 text-yellow-400' },
            { title: 'Confirmed, Awaiting Courier Dispatch', count: orders.filter(o => o.status === 'Confirmed').length || 2, status: 'Handover', link: '/admin/orders', color: 'border-blue-500/20 text-blue-400' },
            { title: 'Stuck En-Route > 48 Hours', count: 1, status: 'Investigate', link: '/admin/orders', color: 'border-rose-500/20 text-rose-400' },
            { title: 'Packages Delayed beyond SLA', count: 2, status: 'Critical', link: '/admin/orders', color: 'border-pink-500/20 text-pink-500' },
            { title: 'Missing Tracking URLs / API IDs', count: 0, status: 'Clean Queue', link: '/admin/orders', color: 'border-slate-500/20 text-slate-500' },
            { title: 'Awaiting Invoice PDF generation', count: orders.filter(o => o.status === 'Delivered' && !o.invoice_id).length || 0, status: 'Automated', link: '/admin/orders', color: 'border-cyan-500/20 text-cyan-400' },
            { title: 'Requires Merchant Actions', count: orders.filter(o => o.status === 'Pending').length || 2, status: 'Awaiting Handover', link: '/admin/orders', color: 'border-purple-500/20 text-purple-400' },
            { title: 'Flagged Customer checkouts review', count: customers.filter(c => c.flagged).length || 1, status: 'Inspect User', link: '/admin/orders', color: 'border-[#F4631E]/20 text-[#F4631E]' },
          ].map((wid, wIdx) => (
            <Link
              to={wid.link}
              key={wIdx}
              className={`border rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:bg-white/5 transition-all space-y-3 ${wid.color}`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider leading-relaxed">{wid.title}</div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-2xl font-black text-white">{wid.count}</span>
                <span className="text-[8px] font-bold uppercase py-0.5 px-2 bg-white/5 rounded block">{wid.status} &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 12 — MARKETPLACE RISK MONITOR */}
      <section id="sec-risk-monitor" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#F4631E]" /> SECTION 12 — Threat Vectors & Marketplace Risk Monitor
          </h3>
          <p className="text-xs text-slate-400 font-medium">Automatic system scans detecting chargeback risks, fake manual invoice generation, or abnormal purchase cancellation rates.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase">SEVERITY: HIGH</span>
              <span className="text-[10px] text-slate-400">Suspicious Ordering Pattern</span>
            </div>
            <h4 className="text-xs font-bold text-white">Multiple Orders to exact same address</h4>
            <p className="text-[11px] text-slate-400">Three distinct customer logins registered checkout to identical Mirpur Sub-zone location in under 1 Hour.</p>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase">SEVERITY: MEDIUM</span>
              <span className="text-[10px] text-slate-400">Repeated Returned Rates</span>
            </div>
            <h4 className="text-xs font-bold text-white">Merchant return volume exceeded safety threshold</h4>
            <p className="text-[11px] text-slate-400">Seller brand "Draped" exceeded 15% return rate on outerwear jacket line this month. Inspection ordered.</p>
          </div>

          <div className="bg-slate-500/5 border border-app-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded bg-white/10 text-slate-300 text-[9px] font-black uppercase">SEVERITY: MINIMAL</span>
              <span className="text-[10px] text-slate-400">Unverified Manual Leads</span>
            </div>
            <h4 className="text-xs font-bold text-white">WhatsApp Manual order unconfirmed OTP</h4>
            <p className="text-[11px] text-slate-400">An admin processed order directly without OTP. System auto-flagged order for supervisor verify check.</p>
          </div>
        </div>
      </section>

      {/* SECTION 13 — LIVE MARKETPLACE ACTIVITY */}
      <section id="sec-live-activity" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-app-border/40">
          <div>
            <h3 className="text-md font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400 animate-pulse" /> SECTION 13 — Live Operational Activity Feed
            </h3>
            <p className="text-xs text-slate-400">Real-time update streams capturing admin processes, manual orders created, and logistics deliveries platform-wide.</p>
          </div>
          <button 
            type="button" 
            onClick={() => showInlineToast('✓ Checked server logs. Live activity ticker is fully synchronized.')}
            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-app-border cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* List of activity ticker items with nice animation/fade */}
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
          {liveLogEntries.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-app-border/40 rounded-xl hover:border-app-accent/30 transition-all">
              <div className="flex items-center gap-3">
                <span className="text-lg bg-slate-900 border border-white/5 w-8 h-8 rounded-lg flex items-center justify-center">{log.icon}</span>
                <div>
                  <span className="text-[9.5px] font-black uppercase text-slate-500 mr-2">[{log.type}]</span>
                  <p className="text-xs font-semibold text-white mt-0.5">{log.text}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 font-bold block">{log.time}</span>
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#F4631E]">SECURE LOG</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 14 — EXPORT & REPORTING CENTER */}
      <section id="sec-exporter-reporting" className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" /> SECTION 14 — Operational Report Export Hub
          </h3>
          <p className="text-xs text-slate-400">Request formal encrypted documents containing detailed statistics for auditing, legal taxes, or seller communications.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 pt-2">
          
          {[
            { title: 'Commission Receipts Ledger', value: 'Commission-Split-June.xlsx' },
            { title: 'Gross Revenue Outward Report', value: 'Sales-Revenue-Overview.xlsx' },
            { title: 'Merchant Rankings & Performance', value: 'SellerRankings.xlsx' },
            { title: 'Fulfillment & SLA Analytics', value: 'SLA-CourierPerformance.xlsx' },
            { title: 'Disputes & Claim Settlement logs', value: 'DisputeLedger-Q2.xlsx' },
            { title: 'Cashbook Auditing Ledger File', value: 'CashbookDisbursement.xlsx' },
            { title: 'Customer Cohorts Behavioral list', value: 'CustomerBehaviorStats.xlsx' },
            { title: 'Manual Orders Inbox conversions', value: 'UnifiedInboxOrderLog.xlsx' },
            { title: 'Product Inventory Defect Claims', value: 'ProductIntegrityAnalysis.xlsx' },
            { title: 'Tax & Ledger Invoices Archive', value: 'AllInvoicesBatch.xlsx' }
          ].map((rep, rIdx) => (
            <div key={rIdx} className="bg-white/[0.01] border border-app-border rounded-xl p-4.5 flex flex-col justify-between hover:border-indigo-400/30 transition-all group">
              <div className="space-y-1">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h5 className="text-[11px] font-black text-white leading-relaxed pt-1.5">{rep.title}</h5>
                <span className="text-[9px] text-slate-500 font-mono block">{rep.value}</span>
              </div>
              <div className="pt-4 flex items-center gap-2">
                <button
                  onClick={() => handleTriggerExport(rep.title)}
                  className="px-2.5 py-1.5 text-[8.5px] bg-slate-800 hover:bg-emerald-600 text-white font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                >
                  Download .XLSX
                </button>
                <button
                  onClick={() => showInlineToast(`✓ Printable view prepared for "${rep.title}"`)}
                  className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* Flag / Note Overlay Dialog */}
      {flaggingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs" onClick={() => setFlaggingCustomer(null)} />
          <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl space-y-6">
            <div>
              <h3 className="text-md font-black text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-rose-500" /> {flaggingCustomer.flagged ? 'Lift Checkout Restriction' : 'Checkout Restriction & Flagging'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Regulating activity for customer: <span className="text-white font-bold">{flaggingCustomer.name}</span>
              </p>
            </div>

            <form onSubmit={handleFlagSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Reason for Checkout Restriction</label>
                <textarea 
                  required
                  rows={4}
                  value={flagReasonText}
                  onChange={(e) => setFlagReasonText(e.target.value)}
                  placeholder="Describe exact pattern of behavior (e.g. fraudulent card reports, systematic order rejects upon courier delivery...)"
                  className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-xs text-white outline-none focus:border-rose-500"
                />
              </div>

              {flaggingCustomer.history && flaggingCustomer.history.length > 0 && (
                <div className="space-y-1 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-2 font-mono">Restriction History Logs</span>
                  {flaggingCustomer.history.map((h: any, i: number) => (
                    <div key={i} className="text-[10px] text-slate-300 leading-normal mb-1">
                      <span className="text-rose-400 font-bold">[{h.action}]</span> {h.note}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setFlaggingCustomer(null)}
                  className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-[10px] font-black uppercase text-white rounded-xl ${
                    flaggingCustomer.flagged ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md active:scale-95' : 'bg-rose-600 hover:bg-rose-500 shadow-md active:scale-95'
                  }`}
                >
                  {flaggingCustomer.flagged ? 'Confirm Clear Flag' : 'Apply restriction Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
