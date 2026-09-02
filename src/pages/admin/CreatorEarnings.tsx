import React, { useState, useMemo } from 'react';
import { useCreatorContext, CreatorPerformance, CreatorEarning, CreatorPayout, CreatorTier, CreatorMilestone } from '../../contexts/CreatorContext';
import {
  Award,
  TrendingUp,
  DollarSign,
  Users,
  Wallet,
  ArrowRight,
  Search,
  Filter,
  ArrowUpDown,
  Check,
  X,
  FileText,
  RefreshCw,
  Percent,
  ExternalLink,
  AlertCircle,
  Undo,
  MessageSquare,
  UserCheck,
  Shield,
  Activity,
  Award as TierIcon,
  ChevronRight,
  TrendingDown,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';

export default function CreatorEarnings() {
  const {
    creatorPerformance,
    creatorEarnings,
    creatorPayouts,
    creatorMilestones,
    updateCreatorTier,
    createPayout,
    approvePayout,
    rejectPayout,
    undoPayoutRejection,
    markPayoutAsPaid,
    auditAllTiers
  } = useCreatorContext();

  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'payouts' | 'performance' | 'tiers'>('overview');

  // Modals & details state
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionUndoTimeout, setRejectionUndoTimeout] = useState<Record<string, boolean>>({});

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | CreatorTier>('All');
  const [earningsMinFilter, setEarningsMinFilter] = useState<number>(0);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'All' | CreatorPayout['status']>('All');
  const [ledgerSourceFilter, setLedgerSourceFilter] = useState<'All' | CreatorEarning['source']>('All');
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState<'All' | string>('All');

  // Interactive local states for editing/suspending
  const [suspendedCreators, setSuspendedCreators] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'warning' | 'error' | 'info' }[]>([]);

  const addToast = (msg: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // CSV Exporter for Finance Team
  const downloadPayoutReport = () => {
    const headers = ['Payout ID', 'Creator ID', 'Creator Name', 'Payout Cycle', 'Earnings (BDT)', 'Status', 'Processed At', 'Paid At', 'Bank Account'];
    const rows = creatorPayouts.map(p => [
      p.id,
      p.creatorId,
      p.creatorName,
      p.payoutCycle,
      p.totalEarnings,
      p.status,
      p.processedAt || '—',
      p.paidAt || '—',
      p.bankAccount || 'Missing Verification'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Choosify_Creator_Payout_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Payout Report CSV generated successfully", "success");
  };

  // Calculated Stats Overview Header
  const cycleSummaryStats = useMemo(() => {
    const totalPayoutsCycle = creatorPayouts
      .filter(p => p.payoutCycle === '2026-05')
      .reduce((sum, p) => sum + p.totalEarnings, 0);

    const pendingApprovalsCount = creatorPayouts.filter(p => p.status === 'pending').length;

    const currentMonthEarnings = creatorEarnings
      .filter(e => e.month === '2026-06')
      .reduce((sum, e) => sum + e.amount, 0);

    const prevMonthEarnings = creatorEarnings
      .filter(e => e.month === '2026-05')
      .reduce((sum, e) => sum + e.amount, 0);

    const trendPercent = prevMonthEarnings > 0
      ? ((currentMonthEarnings - prevMonthEarnings) / prevMonthEarnings) * 100
      : 0;

    return {
      totalPayoutsCycle,
      pendingApprovalsCount,
      currentMonthEarnings,
      trendPercent
    };
  }, [creatorPayouts, creatorEarnings]);

  // Tab 1: Creator Overview calculations
  const tableCreators = useMemo(() => {
    return creatorPerformance.map(p => {
      const stats = creatorEarnings.filter(e => e.creatorId === p.creatorId);
      const currentMonthEarn = stats
        .filter(e => e.month === '2026-06')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalYTDEarn = stats.reduce((sum, e) => sum + e.amount, 0);

      const lastPayout = creatorPayouts
        .filter(pay => pay.creatorId === p.creatorId && pay.status === 'paid')
        .sort((a, b) => b.payoutCycle.localeCompare(a.payoutCycle))[0];

      const pendingPayout = creatorPayouts.find(pay => pay.creatorId === p.creatorId && pay.status === 'pending');

      return {
        ...p,
        currentMonthEarn,
        totalYTDEarn,
        lastPayoutCycle: lastPayout?.payoutCycle || '—',
        lastPayoutAmount: lastPayout?.totalEarnings || 0,
        payoutStatus: pendingPayout ? 'pending' : lastPayout ? 'paid' : 'none'
      };
    });
  }, [creatorPerformance, creatorEarnings, creatorPayouts]);

  // Filters and sorting for Tab 1
  const sortedAndFilteredCreators = useMemo(() => {
    return tableCreators
      .filter(c => {
        const matchesSearch = c.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTier = tierFilter === 'All' || c.tier === tierFilter;
        const matchesMinEarn = c.currentMonthEarn >= earningsMinFilter;

        let matchesPayoutStatus = true;
        if (payoutStatusFilter !== 'All') {
          if (payoutStatusFilter === 'pending') matchesPayoutStatus = c.payoutStatus === 'pending';
          else if (payoutStatusFilter === 'paid') matchesPayoutStatus = c.payoutStatus === 'paid';
          else matchesPayoutStatus = c.payoutStatus === 'none';
        }

        return matchesSearch && matchesTier && matchesMinEarn && matchesPayoutStatus;
      })
      .sort((a, b) => b.currentMonthEarn - a.currentMonthEarn);
  }, [tableCreators, searchQuery, tierFilter, earningsMinFilter, payoutStatusFilter]);

  // Tab 2: Earnings Ledger logic
  const filteredLedger = useMemo(() => {
    return creatorEarnings
      .filter(e => {
        const matchesCreator = searchQuery ? e.creatorName.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        const matchesSource = ledgerSourceFilter === 'All' || e.source === ledgerSourceFilter;
        const matchesMonth = ledgerMonthFilter === 'All' || e.month === ledgerMonthFilter;
        return matchesCreator && matchesSource && matchesMonth;
      })
      .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  }, [creatorEarnings, searchQuery, ledgerSourceFilter, ledgerMonthFilter]);

  const ledgerTotal = useMemo(() => {
    return filteredLedger.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredLedger]);

  // Tab 3: Payout Management queue
  const payoutQueue = useMemo(() => {
    return creatorPayouts
      .filter(p => searchQuery ? p.creatorName.toLowerCase().includes(searchQuery.toLowerCase()) : true)
      .sort((a, b) => b.totalEarnings - a.totalEarnings);
  }, [creatorPayouts, searchQuery]);

  // Tab 4: Performance Analytics charts & metrics
  const performanceAnalytics = useMemo(() => {
    // Top creators by YTD earnings
    const topCreators = tableCreators
      .sort((a, b) => b.totalYTDEarn - a.totalYTDEarn)
      .slice(0, 10)
      .map(c => ({
        name: c.creatorName.split(' ')[0],
        'Earnings BDT': c.totalYTDEarn
      }));

    // Earnings by source (non-blue categorical palette, per design spec)
    const sources = ['guide_performance', 'recommendation_commission', 'sponsorship', 'affiliate', 'bonus'] as const;
    const sourceColors = {
      guide_performance: '#FF5B00',
      recommendation_commission: '#16A34A',
      sponsorship: '#F59E0B',
      affiliate: '#EC4899',
      bonus: '#6C4CFF'
    };

    const earningsBySource = sources.map(src => {
      const total = creatorEarnings
        .filter(e => e.source === src)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        name: src.replace('_', ' ').toUpperCase(),
        value: total,
        color: sourceColors[src]
      };
    }).filter(s => s.value > 0);

    // Tier distribution counts
    const totalCreators = creatorPerformance.length;
    const tiers: CreatorTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    const tierDistribution = tiers.map(t => {
      const count = creatorPerformance.filter(c => c.tier === t).length;
      return {
        tier: t.toUpperCase(),
        count,
        percent: totalCreators > 0 ? ((count / totalCreators) * 100).toFixed(0) : '0'
      };
    });

    return {
      topCreators,
      earningsBySource,
      tierDistribution
    };
  }, [tableCreators, creatorEarnings, creatorPerformance]);

  // Target Creator Selected details
  const selectedCreatorDetails = useMemo(() => {
    if (!selectedCreatorId) return null;
    const creator = creatorPerformance.find(p => p.creatorId === selectedCreatorId);
    if (!creator) return null;

    const stats = creatorEarnings.filter(e => e.creatorId === selectedCreatorId);
    const monthEarnings = stats.filter(e => e.month === '2026-06').reduce((sum, e) => sum + e.amount, 0);
    const ytdEarnings = stats.reduce((sum, e) => sum + e.amount, 0);

    const prevMonthEarnings = stats.filter(e => e.month === '2026-05').reduce((sum, e) => sum + e.amount, 0);
    const monthGrowth = prevMonthEarnings > 0 ? ((monthEarnings - prevMonthEarnings) / prevMonthEarnings) * 100 : 0;

    const milestones = creatorMilestones.filter(m => m.creatorId === selectedCreatorId);
    const payouts = creatorPayouts.filter(p => p.creatorId === selectedCreatorId);

    // Mock recent guides
    const recentGuides = [
      { id: 'g_1', title: 'Top 10 Eid Panjabi Picks in Dhaka', views: 8200, clicks: 420, date: '2026-06-15' },
      { id: 'g_2', title: 'Budget Walton Fridge Buyer Review Guide', views: 5200, clicks: 120, date: '2026-06-12' },
      { id: 'g_3', title: 'Traditional Tangail Saree Retailers Tour', views: 3500, clicks: 80, date: '2026-06-08' }
    ];

    // Determine requirements for next tier
    let nextTierLabel = 'Platinum';
    let requirementText = 'Done!';
    let currentVal = 100;
    let targetVal = 100;

    if (creator.tier === 'bronze') {
      nextTierLabel = 'Silver';
      requirementText = '10 guides, 5k views, 50 followers';
      currentVal = creator.followerCount;
      targetVal = 50;
    } else if (creator.tier === 'silver') {
      nextTierLabel = 'Gold';
      requirementText = '50 guides, 50k views, 500 followers';
      currentVal = creator.followerCount;
      targetVal = 500;
    } else if (creator.tier === 'gold') {
      nextTierLabel = 'Platinum';
      requirementText = '100 guides, 500k views, 5k followers';
      currentVal = creator.followerCount;
      targetVal = 5000;
    }

    return {
      creator,
      monthEarnings,
      ytdEarnings,
      monthGrowth,
      milestones,
      payouts,
      recentGuides,
      nextTierLabel,
      requirementText,
      currentVal,
      targetVal
    };
  }, [selectedCreatorId, creatorPerformance, creatorEarnings, creatorMilestones, creatorPayouts]);

  // Bulk execution payouts handler
  const handleBulkApprovePayouts = () => {
    const pendings = creatorPayouts.filter(p => p.status === 'pending');
    pendings.forEach(p => approvePayout(p.id));
    addToast(`Approved all ${pendings.length} pending payouts`, "success");
  };

  const handleBulkMarkAsPaid = () => {
    const approveds = creatorPayouts.filter(p => p.status === 'approved');
    approveds.forEach(p => markPayoutAsPaid(p.id));
    addToast(`Marked all ${approveds.length} approved payouts as paid`, "success");
  };

  const toggleCreatorSuspension = (id: string) => {
    setSuspendedCreators(prev => {
      const current = !!prev[id];
      addToast(
        current
          ? `Creator earnings resume successfully`
          : `Creator suspended. Future commission attribution paused.`,
        current ? 'success' : 'warning'
      );
      return { ...prev, [id]: !current };
    });
  };

  const subTabs: TabItem[] = [
    { key: 'overview', label: 'Creator Overview' },
    { key: 'ledger', label: 'Earnings Ledger' },
    { key: 'payouts', label: 'Payout Management' },
    { key: 'performance', label: 'Creator Performance' },
    { key: 'tiers', label: 'Tier Progression' }
  ];

  return (
    <div className="space-y-6 text-app-text-primary font-sans animate-in fade-in duration-300">

      {/* Toast Alert Banner overlay */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 bg-white border border-app-border rounded-xl p-4 shadow-2xl">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
              t.type === 'success' ? 'bg-green-500' :
              t.type === 'error' ? 'bg-red-500' :
              t.type === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
            }`} />
            <p className="text-xs font-bold text-app-text-primary leading-tight">{t.msg}</p>
          </div>
        ))}
      </div>

      {/* Header and KPI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[9.5px] font-black uppercase tracking-widest text-app-accent block">FINANCIAL OVERVIEW ENGINE</span>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-app-accent" /> Creator Earnings & Payout Ledger
          </h1>
          <p className="text-app-text-secondary text-[11.5px]">Manage and audit payout approvals, track commission streams, upgrade milestones, and analyze overall influencer growth.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={downloadPayoutReport}
            className="px-4 py-2 bg-white border border-app-border hover:bg-slate-50 text-xs font-black uppercase tracking-widest text-app-text-secondary rounded-md shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-app-accent" /> Generate Payout Report
          </button>

          <button
            onClick={() => {
              auditAllTiers();
              addToast("Tiers updated successfully matching metrics progression", "success");
            }}
            className="px-4 py-2 bg-app-accent-light border border-app-accent/30 hover:bg-app-accent/15 text-app-accent text-xs font-black uppercase tracking-widest rounded-md shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> Audit Tier Accuracy
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white p-5 rounded-xl border border-app-border space-y-1 relative overflow-hidden">
          <span className="text-[10px] text-app-text-secondary font-extrabold uppercase tracking-widest block">Cycle Payouts (May)</span>
          <div className="text-2xl font-extrabold text-app-text-primary font-mono tracking-tight">৳{cycleSummaryStats.totalPayoutsCycle.toLocaleString()}</div>
          <p className="text-[10px] text-app-text-secondary">Total May cleared and pending payout ledger</p>
          <DollarSign className="absolute right-3.5 bottom-3 w-8 h-8 text-slate-100" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-app-border space-y-1 relative overflow-hidden">
          <span className="text-[10px] text-app-text-secondary font-extrabold uppercase tracking-widest block">Pending Approvals</span>
          <div className="text-2xl font-extrabold text-app-accent font-mono tracking-tight">{cycleSummaryStats.pendingApprovalsCount} Queued</div>
          <p className="text-[10px] text-app-text-secondary">Pending verified payout batches</p>
          <Clock className="absolute right-3.5 bottom-3 w-8 h-8 text-slate-100" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-app-border space-y-1 relative overflow-hidden">
          <span className="text-[10px] text-app-text-secondary font-extrabold uppercase tracking-widest block">Month-to-Date Accruals</span>
          <div className="text-2xl font-extrabold text-app-text-primary font-mono tracking-tight">৳{cycleSummaryStats.currentMonthEarnings.toLocaleString()}</div>
          <p className="text-[10px] text-app-text-secondary">Pending June settlement (month-end accrual)</p>
          <TrendingUp className="absolute right-3.5 bottom-3 w-8 h-8 text-slate-100" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-app-border space-y-1 relative overflow-hidden">
          <span className="text-[10px] text-app-text-secondary font-extrabold uppercase tracking-widest block">Monthly Growth Index</span>
          <div className={`text-2xl font-extrabold font-mono tracking-tight flex items-center gap-1 ${
            cycleSummaryStats.trendPercent >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {cycleSummaryStats.trendPercent >= 0 ? '+' : ''}{cycleSummaryStats.trendPercent.toFixed(1)}%
            {cycleSummaryStats.trendPercent >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          <p className="text-[10px] text-app-text-secondary">Compared to last month's overall total</p>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <Tabs tabs={subTabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as typeof activeTab)} />

      {/* FILTER AND CONTROLS SECTION */}
      <div className="bg-white p-4 rounded-xl border border-app-border space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Universal search query input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
            <input
              type="text"
              placeholder="Search creator name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-app-bg border border-app-border rounded-lg text-xs text-app-text-primary outline-none focus:border-app-accent"
            />
          </div>

          {/* Quick Filters based on Tabs */}
          {activeTab === 'overview' && (
            <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto md:justify-end">
              <div className="flex items-center gap-1.5 bg-app-bg px-3 py-1.5 rounded-lg border border-app-border">
                <span className="text-[10px] text-app-text-secondary">Tier:</span>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as any)}
                  className="bg-transparent text-app-text-primary font-bold outline-none"
                >
                  <option value="All">All Tiers</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-app-bg px-3 py-1.5 rounded-lg border border-app-border">
                <span className="text-[10px] text-app-text-secondary">Payout:</span>
                <select
                  value={payoutStatusFilter}
                  onChange={(e) => setPayoutStatusFilter(e.target.value as any)}
                  className="bg-transparent text-app-text-primary font-bold outline-none"
                >
                  <option value="All">All Payout Status</option>
                  <option value="pending">Pending Only</option>
                  <option value="paid">Paid Only</option>
                  <option value="none">No Payout</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto md:justify-end">
              <div className="flex items-center gap-1.5 bg-app-bg px-3 py-1.5 rounded-lg border border-app-border">
                <span className="text-[10px] text-app-text-secondary">Source:</span>
                <select
                  value={ledgerSourceFilter}
                  onChange={(e) => setLedgerSourceFilter(e.target.value as any)}
                  className="bg-transparent text-app-text-primary font-bold outline-none"
                >
                  <option value="All">All Sources</option>
                  <option value="guide_performance">Guide Performance</option>
                  <option value="recommendation_commission">Commission</option>
                  <option value="sponsorship">Sponsorship</option>
                  <option value="bonus">Bonus rewards</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-app-bg px-3 py-1.5 rounded-lg border border-app-border">
                <span className="text-[10px] text-app-text-secondary">Month:</span>
                <select
                  value={ledgerMonthFilter}
                  onChange={(e) => setLedgerMonthFilter(e.target.value as any)}
                  className="bg-transparent text-app-text-primary font-bold outline-none"
                >
                  <option value="All">All Months</option>
                  <option value="2026-06">2026-06 (Current)</option>
                  <option value="2026-05">2026-05</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: CREATOR OVERVIEW CONTENT */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-app-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-bg text-[10px] text-app-text-secondary uppercase tracking-wider font-bold">
                  <th className="p-4">Creator / Joined</th>
                  <th>Status/Tier</th>
                  <th className="text-center">Guides</th>
                  <th className="text-center">Total Views</th>
                  <th className="text-center">Followers</th>
                  <th>June Earnings</th>
                  <th>YTD Accrued</th>
                  <th>Payout Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {sortedAndFilteredCreators.map(c => {
                  const isSuspended = !!suspendedCreators[c.creatorId];
                  return (
                    <tr key={c.creatorId} className={`hover:bg-slate-50 transition-colors ${isSuspended ? 'opacity-50' : ''}`}>
                      <td className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-app-accent-light text-app-accent font-black text-xs flex items-center justify-center">
                          {c.avatar || c.creatorName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-bold text-app-text-primary text-xs">{c.creatorName}</h4>
                          <span className="text-[10px] text-app-text-muted">Joined: {c.joinedAt}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[8.5px] uppercase font-black tracking-wider rounded border ${
                          c.tier === 'platinum' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                          c.tier === 'gold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          c.tier === 'silver' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                          'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          <TierIcon className="w-3 h-3" /> {c.tier}
                        </span>
                      </td>

                      <td className="text-center font-bold text-app-text-primary">{c.guidesPublished}</td>
                      <td className="text-center text-app-text-secondary">{c.totalGuideViews.toLocaleString()}</td>
                      <td className="text-center text-app-text-secondary">{c.followerCount.toLocaleString()}</td>

                      <td className="font-bold text-app-text-primary">৳{c.currentMonthEarn.toLocaleString()}</td>
                      <td className="text-green-600 font-black">৳{c.totalYTDEarn.toLocaleString()}</td>

                      <td>
                        <Badge variant={c.payoutStatus === 'pending' ? 'warning' : c.payoutStatus === 'paid' ? 'success' : 'neutral'}>
                          {c.payoutStatus === 'none' ? 'No unpaid' : c.payoutStatus}
                        </Badge>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCreatorId(c.creatorId)}
                            className="px-2 py-1 bg-white border border-app-border hover:bg-slate-50 text-[10px] uppercase font-black tracking-widest text-app-text-secondary rounded cursor-pointer transition-colors"
                          >
                            Details
                          </button>

                          <button
                            onClick={() => toggleCreatorSuspension(c.creatorId)}
                            className={`px-2 py-1 text-[10px] uppercase font-black tracking-widest rounded cursor-pointer transition-colors ${
                              isSuspended
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-white border border-[#FCA5A5] text-red-600 hover:bg-red-600 hover:text-white'
                            }`}
                          >
                            {isSuspended ? 'Resume' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EARNINGS LEDGER CONTENT */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-app-border overflow-hidden">
          <div className="p-4 bg-app-bg border-b border-app-border flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-bold text-app-text-primary">Consolidated Earnings Audit Ledger (Total BDT: <strong className="text-green-600">৳{ledgerTotal.toLocaleString()}</strong>)</span>
            <span className="text-[10px] text-app-text-muted">Traceable historical accruals logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-bg text-[10px] text-app-text-secondary uppercase tracking-wider font-bold">
                  <th className="p-4">Transaction ID</th>
                  <th>Creator Name</th>
                  <th>Filing Source</th>
                  <th>Accrual month</th>
                  <th>Date Recorded</th>
                  <th>Calculated Earnings</th>
                  <th>Verification status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {filteredLedger.map(e => {
                  // Expanded details builder
                  const hasDetails = !!e.details;
                  return (
                    <React.Fragment key={e.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-app-accent">{e.id}</td>
                        <td className="font-semibold text-app-text-primary">{e.creatorName}</td>
                        <td className="uppercase text-[9px]">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-app-text-secondary">
                            {e.source.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-app-text-secondary">{e.month}</td>
                        <td className="text-app-text-muted">{new Date(e.earnedAt).toLocaleDateString()}</td>
                        <td className="font-extrabold text-app-text-primary">৳{e.amount.toLocaleString()}</td>
                        <td>
                          <Badge variant={e.status === 'verified' ? 'success' : e.status === 'paid' ? 'info' : 'warning'}>
                            {e.status}
                          </Badge>
                        </td>
                      </tr>
                      {hasDetails && (
                        <tr className="bg-app-bg text-[11px] text-app-text-secondary">
                          <td colSpan={7} className="px-4 py-2 border-l-2 border-app-accent">
                            <span className="text-app-accent font-black uppercase text-[9px] mr-2">Audit breakdown:</span>
                            {e.source === 'guide_performance' && (
                              <span>Views performance tracker model: {e.details?.clicks?.toLocaleString() || 0} clicks recorded @ ৳0.50/1k baseViews rate.</span>
                            )}
                            {e.source === 'recommendation_commission' && (
                              <span>Verified click attribution: {e.details?.conversionCount || 0} purchases completed within 24h of client click navigation.</span>
                            )}
                            {e.source === 'bonus' && (
                              <span>Milestone achievement bonus unlock stream.</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYOUT MANAGEMENT QUEUE */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">

          {/* Queue controllers and bulk tools */}
          <div className="bg-white p-4 rounded-xl border border-app-border flex items-center justify-between flex-wrap gap-4 text-xs">
            <span className="font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Active cycle payout approvals queue
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleBulkApprovePayouts}
                className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white font-extrabold uppercase rounded cursor-pointer tracking-wider"
              >
                Approve All Pending
              </button>

              <button
                onClick={handleBulkMarkAsPaid}
                className="px-3.5 py-1.5 bg-app-accent hover:bg-[#FF5B00] text-white font-extrabold uppercase rounded cursor-pointer tracking-wider"
              >
                Mark Approved As Paid
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-app-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-app-border bg-app-bg text-[10px] text-app-text-secondary uppercase tracking-wider font-bold">
                    <th className="p-4">Payee Creator</th>
                    <th>Payment Account Details</th>
                    <th>Billing Cycle</th>
                    <th>Sum Accrued</th>
                    <th>Current Status</th>
                    <th>Administrative Memo</th>
                    <th className="p-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {payoutQueue.map(p => {
                    const isBelowMinimum = p.totalEarnings < 100;
                    const hasNoAccount = !p.bankAccount;
                    const isRejected = p.status === 'failed';

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isBelowMinimum || hasNoAccount ? 'bg-red-50/50' : ''}`}>

                        <td className="p-4">
                          <h4 className="font-bold text-app-text-primary text-xs">{p.creatorName}</h4>
                          <span className="text-[10px] text-app-text-muted">ID: {p.id}</span>
                        </td>

                        <td>
                          {p.bankAccount ? (
                            <span className="text-app-text-secondary">{p.bankAccount}</span>
                          ) : (
                            <span className="text-red-600 font-bold uppercase text-[9.5px] flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Needs Account Verification
                            </span>
                          )}
                        </td>

                        <td className="text-app-text-secondary">{p.payoutCycle}</td>

                        <td className="font-black text-app-text-primary">
                          ৳{p.totalEarnings.toLocaleString()}
                          {isBelowMinimum && (
                            <span className="text-[8px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded border border-amber-200 ml-1">
                              BELOW MIN
                            </span>
                          )}
                        </td>

                        <td>
                          <Badge variant={
                            p.status === 'paid' ? 'success' :
                            p.status === 'approved' ? 'info' :
                            p.status === 'failed' ? 'danger' : 'warning'
                          }>
                            {p.status}
                          </Badge>
                        </td>

                        <td className="text-app-text-secondary text-[11px] max-w-xs truncate">{p.notes || '—'}</td>

                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {p.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    if (hasNoAccount) {
                                      addToast("Cannot approve payout with no bank account details connected", "error");
                                      return;
                                    }
                                    approvePayout(p.id);
                                    addToast(`Payout of ৳${p.totalEarnings} to ${p.creatorName} approved.`, "success");
                                  }}
                                  className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] uppercase font-black tracking-wider rounded cursor-pointer"
                                >
                                  Approve
                                </button>

                                {rejectingId === p.id ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      placeholder="Reason..."
                                      value={rejectReason[p.id] || ''}
                                      onChange={(e) => setRejectReason(prev => ({ ...prev, [p.id]: e.target.value }))}
                                      className="bg-white border border-app-border rounded px-1.5 py-0.5 text-[10px] text-app-text-primary outline-none"
                                    />
                                    <button
                                      onClick={() => {
                                        const reason = rejectReason[p.id]?.trim() || 'Verification failed';
                                        rejectPayout(p.id, reason);
                                        setRejectingId(null);
                                        addToast(`Payout rejected: ${reason}`, "warning");
                                      }}
                                      className="p-1 bg-red-600 text-white rounded cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setRejectingId(null)}
                                      className="p-1 bg-app-bg text-app-text-secondary rounded cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRejectingId(p.id)}
                                    className="px-2 py-1 bg-white border border-[#FCA5A5] text-red-600 hover:bg-red-600 hover:text-white text-[10px] uppercase font-black tracking-wider rounded cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                )}
                              </>
                            )}

                            {p.status === 'approved' && (
                              <button
                                onClick={() => {
                                  markPayoutAsPaid(p.id);
                                  addToast(`Cleared bank transfer payout to ${p.creatorName}`, "success");
                                }}
                                className="px-2 py-1 bg-app-accent hover:bg-[#FF5B00] text-white text-[10px] uppercase font-black tracking-wider rounded cursor-pointer"
                              >
                                Clear Transfer
                              </button>
                            )}

                            {isRejected && (
                              <button
                                onClick={() => {
                                  undoPayoutRejection(p.id);
                                  addToast("Reverted payout rejection. Returned to queue.", "info");
                                }}
                                className="px-2 py-1 bg-white border border-app-border hover:bg-slate-50 text-app-text-secondary text-[10px] uppercase font-black tracking-wider rounded cursor-pointer flex items-center gap-1"
                              >
                                <Undo className="w-3.5 h-3.5" /> Undo
                              </button>
                            )}

                            {p.status === 'paid' && (
                              <span className="text-green-600 font-bold text-[10.5px] uppercase tracking-wider flex items-center gap-1 justify-end">
                                <Check className="w-3.5 h-3.5" /> Settled Paid
                              </span>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CREATOR PERFORMANCE ANALYTICS */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top creators by YTD earnings bar chart */}
            <div className="bg-white p-5 rounded-xl border border-app-border space-y-4">
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-app-accent" /> Top Creators by Cumulative Earnings (YTD BDT)
              </h3>
              <div className="h-64 text-[10.5px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceAnalytics.topCreators}>
                    <XAxis dataKey="name" stroke="#9CA3AF" tickLine={false} />
                    <YAxis stroke="#9CA3AF" tickLine={false} />
                    <ChartTooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8EDF2', color: '#111827' }} />
                    <Bar dataKey="Earnings BDT" fill="#FF5B00" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Earnings by Source pie chart */}
            <div className="bg-white p-5 rounded-xl border border-app-border space-y-4">
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-green-600" /> Attribution Volume share by Accrual Source
              </h3>
              <div className="h-64 flex flex-col md:flex-row items-center justify-between gap-4 text-[10.5px]">
                <div className="h-full w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={performanceAnalytics.earningsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {performanceAnalytics.earningsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E8EDF2', color: '#111827' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full md:w-1/2 space-y-2">
                  {performanceAnalytics.earningsBySource.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs border-b border-app-border pb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-app-text-secondary text-[10.5px] truncate max-w-[130px]">{s.name}</span>
                      </div>
                      <span className="text-app-text-primary font-bold">৳{s.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Tier distribution breakdown */}
          <div className="bg-white p-5 rounded-xl border border-app-border space-y-4">
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Influencer Tier Progression Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {performanceAnalytics.tierDistribution.map(td => (
                <div key={td.tier} className="bg-app-bg border border-app-border p-4 rounded-lg space-y-1">
                  <span className="text-[10px] text-app-text-muted tracking-wider block">{td.tier} TIERS</span>
                  <div className="text-xl font-extrabold text-app-text-primary">{td.count} Creators</div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-app-accent rounded-full" style={{ width: `${td.percent}%` }} />
                  </div>
                  <span className="text-[9.5px] text-app-accent mt-1 block font-bold">{td.percent}% of platform corpus</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TIER MANAGEMENT */}
      {activeTab === 'tiers' && (
        <div className="bg-white rounded-xl border border-app-border overflow-hidden">
          <div className="p-4 bg-app-bg border-b border-app-border text-xs flex justify-between items-center flex-wrap gap-2">
            <span className="font-bold text-app-text-primary uppercase tracking-wider">Creator tier advancement auditing desk</span>
            <span className="text-amber-600 font-bold uppercase text-[9.5px] flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Policy Enforced lock
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-bg text-[10px] text-app-text-secondary uppercase tracking-wider font-bold">
                  <th className="p-4">Creator</th>
                  <th>Current Tier</th>
                  <th>Next Level Requirement</th>
                  <th className="min-w-[180px]">Follower Progression</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {creatorPerformance.map(c => {
                  let nextTier: CreatorTier = 'platinum';
                  let targetFollowers = 5000;

                  if (c.tier === 'bronze') {
                    nextTier = 'silver';
                    targetFollowers = 50;
                  } else if (c.tier === 'silver') {
                    nextTier = 'gold';
                    targetFollowers = 500;
                  } else if (c.tier === 'gold') {
                    nextTier = 'platinum';
                    targetFollowers = 5000;
                  }

                  const percent = Math.min(100, (c.followerCount / targetFollowers) * 100);

                  return (
                    <tr key={c.creatorId} className="hover:bg-slate-50 transition-colors">

                      <td className="p-4">
                        <h4 className="font-bold text-app-text-primary text-xs">{c.creatorName}</h4>
                        <span className="text-[10px] text-app-text-muted">ID: {c.creatorId}</span>
                      </td>

                      <td>
                        <span className="text-app-text-primary uppercase font-bold tracking-wider">{c.tier}</span>
                      </td>

                      <td>
                        {c.tier === 'platinum' ? (
                          <span className="text-green-600 font-bold uppercase text-[10px]">Peak Level Reached</span>
                        ) : (
                          <span className="text-app-text-secondary font-semibold">{targetFollowers.toLocaleString()} Followers for <strong className="text-app-text-primary uppercase">{nextTier}</strong></span>
                        )}
                      </td>

                      <td className="py-4">
                        {c.tier !== 'platinum' ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-app-text-secondary">
                              <span>Progress:</span>
                              <span>{c.followerCount}/{targetFollowers}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="h-full bg-app-accent rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-app-text-muted">100% Fulfilled</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {c.tier !== 'platinum' && (
                          <button
                            onClick={() => {
                              updateCreatorTier(c.creatorId, nextTier);
                              addToast(`Promoted ${c.creatorName} to ${nextTier.toUpperCase()}`, "success");
                            }}
                            className="px-2.5 py-1 bg-app-accent-light border border-app-accent/30 hover:bg-app-accent/15 text-app-accent text-[10px] uppercase font-black tracking-wider rounded cursor-pointer transition-colors"
                          >
                            Promote Early
                          </button>
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

      {/* DETAILED CREATOR MODAL WINDOW */}
      {selectedCreatorId && selectedCreatorDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-app-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-150">

            {/* Modal Exit handle */}
            <button
              onClick={() => setSelectedCreatorId(null)}
              className="absolute top-4 right-4 text-app-text-secondary hover:text-app-accent cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="p-6 bg-app-bg border-b border-app-border flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-app-accent-light text-app-accent font-black text-sm flex items-center justify-center border border-app-accent/20">
                {selectedCreatorDetails.creator.avatar || selectedCreatorDetails.creator.creatorName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h2 className="text-base font-black text-app-text-primary">{selectedCreatorDetails.creator.creatorName}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-widest text-app-accent">Tier level: {selectedCreatorDetails.creator.tier}</span>
                  <span className="text-app-text-muted text-[10px]">Joined: {selectedCreatorDetails.creator.joinedAt}</span>
                </div>
              </div>
            </div>

            {/* Modal Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">

              {/* Left Column (60%) */}
              <div className="lg:col-span-7 space-y-6">

                {/* Recent Earnings box */}
                <div className="bg-app-bg p-4 rounded-xl border border-app-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10.5px] uppercase font-bold text-app-text-secondary">Recent Accruals (30 days)</span>
                    <span className={`text-[10px] font-bold ${
                      selectedCreatorDetails.monthGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedCreatorDetails.monthGrowth >= 0 ? '+' : ''}{selectedCreatorDetails.monthGrowth.toFixed(1)}% vs prev month
                    </span>
                  </div>
                  <div className="text-3xl font-black text-app-text-primary">৳{selectedCreatorDetails.monthEarnings.toLocaleString()} BDT</div>

                  {/* Subtle static trend diagram bar */}
                  <div className="pt-2">
                    <div className="text-[9px] text-app-text-muted uppercase">Attributed Daily Earnings trend</div>
                    <div className="h-10 flex items-end gap-1.5 mt-1">
                      {[25, 40, 18, 55, 60, 48, 80, 95, 30, 45, 60, 85].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-app-accent/40 to-app-accent rounded-sm hover:opacity-80 transition-opacity"
                          style={{ height: `${h}%` }}
                          title={`Day ${i+1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Core metrics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Guides', val: selectedCreatorDetails.creator.guidesPublished },
                    { label: 'Recommendations', val: selectedCreatorDetails.creator.recommendationsCreated },
                    { label: 'Total Views', val: selectedCreatorDetails.creator.totalGuideViews.toLocaleString() },
                    { label: 'Engagement Rate', val: `${selectedCreatorDetails.creator.engagementRate}%` }
                  ].map(item => (
                    <div key={item.label} className="bg-app-bg p-3 rounded-lg border border-app-border">
                      <span className="text-[9px] text-app-text-muted tracking-wider block">{item.label}</span>
                      <span className="text-sm font-black text-app-text-primary block mt-1">{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* Recent Guides List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Top Performing Guides</h3>
                  <div className="space-y-2">
                    {selectedCreatorDetails.recentGuides.map(rg => (
                      <div key={rg.id} className="p-3 bg-app-bg rounded-lg border border-app-border flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-app-text-primary truncate max-w-xs">{rg.title}</h4>
                          <span className="text-[9.5px] text-app-text-muted">Published: {rg.date}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[9px] text-app-text-muted block uppercase">Views</span>
                            <span className="text-app-text-primary font-bold">{rg.views.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-app-text-muted block uppercase">Clicks</span>
                            <span className="text-app-accent font-bold">{rg.clicks.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column (40%) */}
              <div className="lg:col-span-5 space-y-6">

                {/* Financial Payout Summary panel */}
                <div className="bg-app-bg p-4 rounded-xl border border-app-border space-y-3.5">
                  <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider border-b border-app-border pb-2">Financial Settlements</h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-app-text-secondary">Current Month Accrual:</span>
                      <span className="text-app-text-primary font-bold">৳{selectedCreatorDetails.monthEarnings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-app-text-secondary">Settled YTD Earnings:</span>
                      <span className="text-green-600 font-bold">৳{selectedCreatorDetails.ytdEarnings.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-app-text-secondary">Masked Settlement bank:</span>
                      <span className="text-app-text-secondary font-bold">{selectedCreatorDetails.creator.creatorId === 'creator_rafsan' ? 'BRAC Bank Ltd' : selectedCreatorDetails.creator.creatorId === 'creator_khalid' ? 'City Bank Ltd' : selectedCreatorDetails.creator.creatorId === 'creator_tawhid' ? 'Dutch-Bangla Bank' : 'Unverified bank'}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        const success = createPayout(selectedCreatorDetails.creator.creatorId, '2026-06');
                        if (success) {
                          addToast(`Calculated June settlement and queued for approval`, "success");
                          setSelectedCreatorId(null);
                        } else {
                          addToast(`No unpaid June earnings to settle`, "warning");
                        }
                      }}
                      className="w-full py-2 bg-app-accent hover:bg-[#FF5B00] text-white font-extrabold uppercase text-xs tracking-widest rounded-lg cursor-pointer"
                    >
                      Trigger June Settlement
                    </button>
                  </div>
                </div>

                {/* Next Tier Progression */}
                {selectedCreatorDetails.creator.tier !== 'platinum' && (
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border space-y-3">
                    <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Level Advancement</h3>
                    <div className="text-xs text-app-text-secondary font-semibold leading-relaxed">
                      Next Level Goal: <strong className="text-app-text-primary uppercase">{selectedCreatorDetails.nextTierLabel}</strong>
                      <p className="text-[10px] text-app-text-muted mt-1">Requires: {selectedCreatorDetails.requirementText}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-app-text-secondary">
                        <span>Advancement progress:</span>
                        <span>{selectedCreatorDetails.creator.followerCount} / {selectedCreatorDetails.targetVal} followers</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-green-600 rounded-full"
                          style={{ width: `${Math.min(100, (selectedCreatorDetails.creator.followerCount / selectedCreatorDetails.targetVal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Milestones achieved */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Achievement Badges</h3>
                  <div className="space-y-2">
                    {selectedCreatorDetails.milestones.map(m => (
                      <div key={m.id} className="p-2.5 bg-app-bg rounded-lg border border-app-border flex items-center gap-2.5 text-xs">
                        <Award className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <h4 className="font-bold text-app-text-secondary capitalize">{m.milestone.replace('_', ' ')}</h4>
                          <span className="text-[10px] text-app-text-muted">Unlocked: {m.achievedAt}</span>
                        </div>
                      </div>
                    ))}
                    {selectedCreatorDetails.milestones.length === 0 && (
                      <p className="text-xs text-app-text-muted">No milestone achievements registered yet.</p>
                    )}
                  </div>
                </div>

                {/* Quick actions box */}
                <div className="flex flex-col gap-2 pt-2 border-t border-app-border">
                  <button
                    onClick={() => {
                      alert(`Mock dispatched: Messenger dispatch code initialized targeting ${selectedCreatorDetails.creator.creatorName}`);
                    }}
                    className="w-full py-1.5 border border-app-border hover:bg-slate-50 bg-white text-app-text-primary text-xs font-bold uppercase tracking-wider rounded cursor-pointer text-center"
                  >
                    Send Chat Notification
                  </button>
                  <button
                    onClick={() => {
                      alert(`Mock profile edit: Opened designer editor panel for ${selectedCreatorDetails.creator.creatorName}`);
                    }}
                    className="w-full py-1.5 border border-app-border hover:bg-slate-50 bg-white text-app-text-primary text-xs font-bold uppercase tracking-wider rounded cursor-pointer text-center"
                  >
                    Edit Profile Ledger
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
