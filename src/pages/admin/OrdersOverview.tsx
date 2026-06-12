import React, { useState } from 'react';
import { useOrders, Order, Customer, OrderStatus, CustomerBehavior } from '../../contexts/OrdersContext';
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
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
  BadgePercent
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
  Cell 
} from 'recharts';

export default function OrdersOverview() {
  const { orders, customers, flagCustomer, updateOrderStatus } = useOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeframe, setTimeframe] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('All');
  const [selectedBehaviorFilter, setSelectedBehaviorFilter] = useState<'All' | CustomerBehavior>('All');

  // Customer Flag modal states
  const [flaggingCustomer, setFlaggingCustomer] = useState<Customer | null>(null);
  const [flagReasonText, setFlagReasonText] = useState('');

  // 1. Calculations & Metrics
  const totalOrders = orders.length;
  const totalSalesVolume = orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.product.price, 0);
  
  const totalSuccessfulDeliveries = orders.filter(o => o.status === 'Delivered').length;
  const totalCancellations = orders.filter(o => o.status === 'Cancelled').length;

  // Revenue formulas
  const platformFeePercentage = 10; // Commission placeholder
  const platformRevenue = orders
    .filter(o => o.status === 'Delivered')
    .reduce((sum, o) => sum + o.earnings.futureAutomatedDeduction, 0);

  // Seller-wise breakdown
  const sellers = Array.from(new Set(orders.map(o => o.product.sellerName)));
  const sellerBreakdown = sellers.map(sellerName => {
    const sellerOrders = orders.filter(o => o.product.sellerName === sellerName);
    const completed = sellerOrders.filter(o => o.status === 'Delivered').length;
    const cancelled = sellerOrders.filter(o => o.status === 'Cancelled').length;
    const pending = sellerOrders.filter(o => o.status === 'Pending').length;
    const revenue = sellerOrders
      .filter(o => o.status === 'Delivered')
      .reduce((sum, o) => sum + o.product.price, 0);
    const grossCommission = sellerOrders
      .filter(o => o.status === 'Delivered')
      .reduce((sum, o) => sum + o.earnings.futureAutomatedDeduction, 0);

    return {
      name: sellerName,
      total: sellerOrders.length,
      completed,
      cancelled,
      pending,
      revenue,
      grossCommission,
      netSellerEarnings: revenue - grossCommission
    };
  });

  // Product-wise revenue
  const productRevenueMap: Record<string, { price: number; name: string; count: number }> = {};
  orders.forEach(o => {
    if (o.status === 'Delivered') {
      if (!productRevenueMap[o.product.id]) {
        productRevenueMap[o.product.id] = { price: 0, name: o.product.name, count: 0 };
      }
      productRevenueMap[o.product.id].price += o.product.price;
      productRevenueMap[o.product.id].count += 1;
    }
  });
  const productWiseRevenue = Object.values(productRevenueMap).sort((a,b) => b.price - a.price);

  // Time-based stats for charts (flexible mock with timeframe multipliers)
  const getTimebaseMultipliers = () => {
    const stats: Record<typeof timeframe, { label: string; orders: number; revenue: number }[]> = {
      'Daily': [
        { label: '09:00', orders: 1, revenue: 4200 },
        { label: '11:00', orders: 3, revenue: 14500 },
        { label: '14:00', orders: 2, revenue: 8400 },
        { label: '17:00', orders: 4, revenue: 148199 },
        { label: '20:00', orders: 1, revenue: 3500 },
      ],
      'Weekly': [
        { label: 'Mon', orders: 5, revenue: 21000 },
        { label: 'Tue', orders: 8, revenue: 38000 },
        { label: 'Wed', orders: 12, revenue: 145000 },
        { label: 'Thu', orders: 7, revenue: 29900 },
        { label: 'Fri', orders: 14, revenue: 184500 },
        { label: 'Sat', orders: 10, revenue: 48900 },
        { label: 'Sun', orders: 6, revenue: 31200 },
      ],
      'Monthly': [
        { label: 'Jan', orders: 45, revenue: 220000 },
        { label: 'Feb', orders: 62, revenue: 380000 },
        { label: 'Mar', orders: 88, revenue: 510000 },
        { label: 'Apr', orders: 104, revenue: 640000 },
        { label: 'May', orders: 130, revenue: 780000 },
      ],
      'Quarterly': [
        { label: 'Q1', orders: 195, revenue: 1110000 },
        { label: 'Q2', orders: 234, revenue: 1420000 },
        { label: 'Q3', orders: 210, revenue: 1290000 },
        { label: 'Q4', orders: 320, revenue: 1980000 },
      ],
      'Yearly': [
        { label: '2023', orders: 840, revenue: 4500000 },
        { label: '2024', orders: 1205, revenue: 6800000 },
        { label: '2025', orders: 2011, revenue: 11400000 },
        { label: '2026 (YTD)', orders: 1612, revenue: 9540000 },
      ],
    };
    return stats[timeframe];
  };
  const activeTimeCharts = getTimebaseMultipliers();

  // 2. Customer behavior analytics calculations
  const customerAnalytics = customers.map(cust => {
    const custOrders = orders.filter(o => o.customer.email === cust.email);
    const placed = custOrders.length;
    const completed = custOrders.filter(o => o.status === 'Delivered').length;
    const cancelled = custOrders.filter(o => o.status === 'Cancelled').length;
    const pending = custOrders.filter(o => o.status === 'Pending').length;

    // Classification Logic: Good vs Neutral vs Risk based on completion / cancellation
    let behaviorGrade: CustomerBehavior = 'Neutral';
    if (placed > 1 && completed / placed >= 0.75) {
      behaviorGrade = 'Good';
    } else if (cancelled / placed >= 0.4 || cust.flagged) {
      behaviorGrade = 'Risk';
    }

    return {
      ...cust,
      stats: {
        placed,
        completed,
        cancelled,
        pending
      },
      computedBehavior: behaviorGrade
    };
  });

  // Filter customers based on search & behavior
  const filteredCustomerAnalytics = customerAnalytics.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedBehaviorFilter === 'All') return matchesSearch;
    return matchesSearch && item.computedBehavior === selectedBehaviorFilter;
  });

  const handleFlagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flaggingCustomer) return;
    flagCustomer(flaggingCustomer.id, !flaggingCustomer.flagged, flagReasonText || 'Administrative override.');
    setFlaggingCustomer(null);
    setFlagReasonText('');
  };

  const startFlagging = (cust: Customer) => {
    setFlaggingCustomer(cust);
    setFlagReasonText(cust.flagReason || '');
  };

  return (
    <div className="space-y-8 pb-16 text-sans">
      
      {/* Platform Title Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-app-accent/15 rounded-full border border-app-accent/20">
            <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-ping" />
            <span className="text-[10px] font-black tracking-widest text-app-accent-light uppercase">Platform Control Base</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            Orders Overview & Revenue Analytics
          </h1>
          <p className="text-xs text-app-text-secondary max-w-2xl leading-relaxed">
            Authorized platform financial engine. Monitor seller performance statistics, oversee transaction flows, regulate risk-grade client statuses, and optimize future billing commissions.
          </p>
        </div>

        <div className="flex gap-2 bg-app-bg p-1.5 rounded-2xl border border-app-border shrink-0 self-start">
          {(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${timeframe === t ? 'bg-app-accent text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main Top Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-app-card border border-app-border rounded-[2rem] p-6 flex items-center justify-between shadow-xl relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Sales volume</span>
            <div className="text-2xl font-black text-white">৳ {totalSalesVolume.toLocaleString()}</div>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% platform growth
            </span>
          </div>
          <div className="p-4 bg-app-accent/15 rounded-2xl">
            <DollarSign className="w-6 h-6 text-app-accent" />
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-[2rem] p-6 flex items-center justify-between shadow-xl">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Accumulated Orders</span>
            <div className="text-2xl font-black text-white">{totalOrders}</div>
            <span className="text-[10px] text-slate-400">Total processed system-wide</span>
          </div>
          <div className="p-4 bg-blue-500/15 rounded-2xl">
            <ShoppingBag className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-[2rem] p-6 flex items-center justify-between shadow-xl">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Delivered Fulfillment</span>
            <div className="text-2xl font-black text-emerald-500">{totalSuccessfulDeliveries}</div>
            <span className="text-[10px] text-emerald-500">{(totalSuccessfulDeliveries / (totalOrders || 1) * 100).toFixed(0)}% completion rate</span>
          </div>
          <div className="p-4 bg-emerald-500/15 rounded-2xl">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-[2rem] p-6 flex items-center justify-between shadow-xl">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Disputes & Cancellations</span>
            <div className="text-2xl font-black text-rose-500">{totalCancellations}</div>
            <span className="text-[10px] text-rose-500">{(totalCancellations / (totalOrders || 1) * 100).toFixed(0)}% collapse rate</span>
          </div>
          <div className="p-4 bg-rose-500/15 rounded-2xl">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Financial Split / Future Commission Engine Prep */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-500" /> Administrative Commission Ledger (Commission Prep Panel)
            </h3>
            <p className="text-xs text-slate-400">
              Future Automated Deduction Split Preview. Setup potential billing cycles and model automated earnings split.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
            <Percent className="w-4 h-4 text-emerald-500" />
            <div>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Default Commission Rate</span>
              <span className="text-xs font-black text-white">{platformFeePercentage}% Automated Deduction</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Delivered Gross Volume</span>
            <span className="text-xl font-black text-white">৳ {orders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + o.product.price, 0).toLocaleString()}</span>
            <p className="text-[9px] text-slate-500 mt-2">Only delivered items aggregate platform-wide revenue payouts.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Estimated Platform Fee (Revenue)</span>
            <span className="text-xl font-black text-emerald-400">৳ {platformRevenue.toLocaleString()}</span>
            <p className="text-[9px] text-teal-500 mt-2">Calculated at standard {platformFeePercentage}% flat. Ready for ledger auto-split.</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Net Seller Payouts Ledger</span>
            <span className="text-xl font-black text-blue-400">৳ {(orders.filter(o => o.status === 'Delivered').reduce((sum, o) => sum + o.product.price, 0) - platformRevenue).toLocaleString()}</span>
            <p className="text-[9px] text-slate-500 mt-2">Ready to be processed into external bank transfers / clearances.</p>
          </div>
        </div>
      </div>

      {/* Sales Volume / Time-Based Revenue Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Recharts Area Analytics */}
        <div className="xl:col-span-2 bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-md font-black text-white">{timeframe}-based Volume Progression</h3>
              <p className="text-[11px] text-slate-500">Live transaction progression index across platform</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-app-accent" /> Gross Revenue
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeTimeCharts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EB4501" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EB4501" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                  formatter={(val) => [`৳ ${val.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#EB4501" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Productwise Revenue distribution */}
        <div className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
          <div>
            <h3 className="text-md font-black text-white">Top Products by Revenue</h3>
            <p className="text-[11px] text-slate-500">Direct breakdown of top-selling items</p>
          </div>

          <div className="space-y-4">
            {productWiseRevenue.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 bg-app-bg border border-app-border rounded-xl">
                <div className="min-w-0 pr-2">
                  <div className="text-[11px] font-black text-white truncate">{product.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{product.count} sales completed</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-black text-app-accent-light">৳ {product.price.toLocaleString()}</div>
                  <span className="text-[8px] font-bold text-slate-500">SHARE: {((product.price / (totalSalesVolume || 1)) * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seller Performance Grid */}
      <section className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div>
          <h3 className="text-md font-black text-white">Merchant Seller-wise Breakdown</h3>
          <p className="text-xs text-slate-500">Monitor volume, successful clearances, reject percentages, and gross taxation per merchant partner.</p>
        </div>

        <div className="overflow-x-auto border border-app-border rounded-2xl custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="p-4">Merchant Title</th>
                <th className="p-4 text-center">Placed Orders</th>
                <th className="p-4 text-center">Fulfill Rate</th>
                <th className="p-4 text-center">Rejects</th>
                <th className="p-4 text-right">Revenue Generated</th>
                <th className="p-4 text-right">Estimated Commission</th>
                <th className="p-4 text-center">Logistics Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40">
              {sellerBreakdown.map((s, idx) => {
                const completionRate = s.total > 0 ? (s.completed / s.total) * 100 : 0;
                return (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-[11px]">{s.name}</div>
                      <div className="text-[9px] text-slate-500">Auto Split Active</div>
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-white">{s.total}</td>
                    <td className="p-4 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        completionRate >= 75 
                          ? 'text-emerald-500 bg-emerald-500/10' 
                          : completionRate >= 50 
                          ? 'text-amber-500 bg-amber-500/10' 
                          : 'text-rose-500 bg-rose-500/10'
                      }`}>
                        {completionRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-4 text-center font-semibold text-rose-500">{s.cancelled}</td>
                    <td className="p-4 text-right font-bold text-white">৳ {s.revenue.toLocaleString()}</td>
                    <td className="p-4 text-right font-black text-emerald-400">৳ {s.grossCommission.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-black tracking-wider uppercase">
                        Payout Ready
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customer behavior analytics and flagging engine */}
      <section className="bg-app-card border border-app-border rounded-[2.5rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-md font-black text-white">Customer Order Analytics & Intelligence Behavior Tracking</h3>
            <p className="text-xs text-slate-500">Audit cancellation behaviors, track undelivered packages, flag threat vectors, and restrict checkout operations.</p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
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

            <div className="flex items-center bg-app-bg p-1 rounded-xl border border-app-border gap-1">
              {(['All', 'Good', 'Neutral', 'Risk'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setSelectedBehaviorFilter(b)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${selectedBehaviorFilter === b ? 'bg-app-accent text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-app-border rounded-2xl custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-app-bg border-b border-app-border text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="p-4">Customer identity</th>
                <th className="p-4 text-center">Orders Placed</th>
                <th className="p-4 text-center">Success (Delivered)</th>
                <th className="p-4 text-center">Cancelled / Disputed</th>
                <th className="p-4 text-center">Risk Classification</th>
                <th className="p-4 text-center">Flag Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40">
              {filteredCustomerAnalytics.map((c, idx) => {
                return (
                  <tr key={idx} className="hover:bg-white/[0.01]">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {c.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-white text-[11px]">{c.name}</div>
                        <div className="text-[9px] text-slate-500">{c.email}</div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-white">{c.stats.placed}</td>
                    <td className="p-4 text-center font-mono font-bold text-emerald-500">{c.stats.completed}</td>
                    <td className="p-4 text-center font-mono font-bold text-rose-500">{c.stats.cancelled}</td>
                    <td className="p-4 text-center">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                        c.computedBehavior === 'Good' 
                          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                          : c.computedBehavior === 'Risk' 
                          ? 'text-rose-500 bg-rose-500/10 border-rose-500/20 animate-pulse' 
                          : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {c.computedBehavior} Rated
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded inline-flex items-center gap-1 ${
                        c.flagged 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-extrabold' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {c.flagged ? '🚩 Restricted' : '🟢 Eligible'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => startFlagging(c)}
                        className={`text-[9px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all ${
                          c.flagged 
                            ? 'bg-white/5 border border-slate-700 text-slate-300 hover:bg-white/10' 
                            : 'bg-rose-600 border border-rose-500 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/10 active:scale-95'
                        }`}
                      >
                        {c.flagged ? 'Clear Flag' : 'Flag / Restrict'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Flag / Note Overlay Dialog */}
      {flaggingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setFlaggingCustomer(null)} />
          <div className="bg-app-card border border-app-border rounded-[2rem] p-8 w-full max-w-md relative z-10 shadow-2xl space-y-6">
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Reason for Checkout Restriction</label>
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
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Restriction History Logs</span>
                  {flaggingCustomer.history.map((h, i) => (
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
                    flaggingCustomer.flagged ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
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
