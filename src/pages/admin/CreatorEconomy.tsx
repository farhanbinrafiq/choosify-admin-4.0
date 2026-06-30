import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTrust, CreatorCampaign, CreatorBrandPartnership, RecommendationMetric, CreatorPayout } from '../../contexts/TrustContext';
import { useCreatorContext } from '../../contexts/CreatorContext';
import { 
  Award, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Lightbulb, 
  Briefcase, 
  MousePointerClick, 
  ShoppingBag, 
  Plus, 
  Check, 
  X, 
  ChevronRight, 
  Sliders, 
  Percent, 
  Wallet,
  Activity,
  Play
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  CartesianGrid,
  Legend
} from 'recharts';

export default function CreatorEconomy() {
  const {
    recommendationMetrics,
    partnerships,
    campaigns,
    creatorPayouts,
    creatorTiers,
    proposePartnership,
    updatePartnershipStatus,
    createCampaign,
    processCreatorPayout,
    logRecommendationActivity,
    dailyCreatorMetrics
  } = useTrust();

  const { creatorPerformance } = useCreatorContext();

  // Active sub-tabs inside Creator Hub
  const [activeTab, setActiveTab] = useState<'analytics' | 'campaigns' | 'partnerships' | 'tiers' | 'payouts'>('analytics');
  
  // Interactive creation state
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBrandId, setCampaignBrandId] = useState('brand_aarong');
  const [campaignBrandName, setCampaignBrandName] = useState('Aarong Handcrafts');
  const [campaignBudget, setCampaignBudget] = useState<number>(100000);
  const [campaignRate, setCampaignRate] = useState<number>(10);

  // Selector for simulation click/conv
  const [selectedRecToSim, setSelectedRecToSim] = useState<string>('rec_02');

  // Partnership creation
  const [creatorPId, setCreatorPId] = useState('creator_tawhid');
  const [creatorPName, setCreatorPName] = useState('Tawhid Afridi');
  const [brandPId, setBrandPId] = useState('brand_aarong');
  const [brandPName, setBrandPName] = useState('Aarong Handcrafts');

  const getCTR = (clicks: number, views: number) => {
    if (views === 0) return '0.00%';
    return `${((clicks / views) * 100).toFixed(2)}%`;
  };

  const getConversionRate = (conversions: number, clicks: number) => {
    if (clicks === 0) return '0.00%';
    return `${((conversions / clicks) * 100).toFixed(2)}%`;
  };

  // Human metrics calculations
  const totalFinancials = useMemo(() => {
    let totalRevenue = 0;
    let totalAffiliatePayoutsAccrued = 0;
    let totalClicks = 0;
    let totalViews = 0;
    let totalConversions = 0;

    recommendationMetrics.forEach(r => {
      totalRevenue += r.revenue;
      totalAffiliatePayoutsAccrued += r.creator_earnings;
      totalClicks += r.clicks;
      totalViews += r.views;
      totalConversions += r.conversions;
    });

    const averageCTR = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0';
    const averageConvRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 105).toFixed(2) : '0';

    return { totalRevenue, totalAffiliatePayoutsAccrued, totalClicks, totalConversions, averageCTR, averageConvRate };
  }, [recommendationMetrics]);

  // Handle partnership submits
  const handleProposePartnershipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    proposePartnership(creatorPId, creatorPName, brandPId, brandPName);
    alert(`Partnership proposal dispatched between ${creatorPName} and ${brandPName}!`);
  };

  const handleCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim()) return;
    createCampaign(campaignBrandId, campaignBrandName, campaignTitle, campaignBudget, campaignRate, '2026-06-12', '2026-08-12');
    setCampaignTitle('');
    setShowCampaignForm(false);
  };

  // CHART 1: CREATOR REVENUE GENERATION PER RECOMMENDATION
  const creatorCommissionChartData = useMemo(() => {
    return recommendationMetrics.map(r => ({
      name: r.owner_name.split(' ')[0], 
      'Generated Revenue BDT': r.revenue,
      'Paid out Commission': r.creator_earnings
    }));
  }, [recommendationMetrics]);

  // CHART 2: DAILY PERFORMANCE LINE CHART (PHASE 4 AGGREGATIONS)
  const creatorDailyPerformanceChartData = useMemo(() => {
    return dailyCreatorMetrics.map(d => ({
      name: d.date,
      'Affiliate Clicks': d.clicks,
      'Paid Out Accruals': Math.round(d.payout_accrued / 10),
      'Conv Rate (%)': d.conversion_rate
    }));
  }, [dailyCreatorMetrics]);

  return (
    <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <span>Enterprise Admin</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">Creator economy & Attribution</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-app-accent-light" /> Creator Economy & Recommendation Analytics
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            Affiliate commission attribution engine, click-through performance telemetry, and brand partnership management modules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/creator-earnings"
            className="px-4 py-2 bg-gradient-to-r from-[#F4631E]/20 to-[#F4631E]/10 hover:from-[#F4631E]/30 hover:to-[#F4631E]/15 border border-[#F4631E]/40 text-[#F4631E] text-xs font-black uppercase tracking-wider rounded-[4px] shadow cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4 animate-pulse" /> Review Creator Earnings Console
          </Link>

          <div className="flex items-center gap-2 bg-slate-900 border border-app-border rounded-[4px] px-3.5 py-1.5 text-xs text-white">
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-ping" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#8E9BAE]">Attribution Engine Live</span>
          </div>
        </div>
      </div>

      {/* ATTRIBUTION HIGH VALUE INDEX KPI PANEL - PHASE 4 & 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl space-y-1 relative group">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Total Tracked Revenue</span>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">৳{totalFinancials.totalRevenue.toLocaleString()}</div>
          <p className="text-[10px] text-green-400 flex items-center gap-0.5">
            <TrendingUp className="w-3.5 h-3.5" /> 8.7% Attribution CTR standard
          </p>
          <ShoppingBag className="absolute right-4 top-4 w-7 h-7 text-slate-500/10" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl space-y-1 relative group">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Creator Commission accrued</span>
          <div className="text-2xl font-extrabold text-[#EB4501] font-mono tracking-tight">৳{totalFinancials.totalAffiliatePayoutsAccrued.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500">10% Default partnership share active</p>
          <Wallet className="absolute right-4 top-4 w-7 h-7 text-slate-500/10" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl space-y-1 relative group">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Clicks / Traffic conversions</span>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">{totalFinancials.totalClicks.toLocaleString()}</div>
          <p className="text-[10px] text-slate-500">Avg CTR: <strong className="text-white">{totalFinancials.averageCTR}%</strong></p>
          <MousePointerClick className="absolute right-4 top-4 w-7 h-7 text-slate-500/10" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl space-y-1 relative group">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Affiliate conversions</span>
          <div className="text-2xl font-extrabold text-white font-mono tracking-tight">{totalFinancials.totalConversions.toLocaleString()} orders</div>
          <p className="text-[10px] text-slate-500">Conversion Rate: <strong className="text-white">{totalFinancials.averageConvRate}%</strong></p>
          <Briefcase className="absolute right-4 top-4 w-7 h-7 text-slate-500/10" />
        </div>

      </div>

      {/* TAB CONTROL SWITCHER */}
      <div className="flex border-b border-white/[0.04] gap-2 font-mono text-[11px] font-extrabold uppercase select-none">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'analytics' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Telemetry & Analytics
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'campaigns' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Brand Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('partnerships')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'partnerships' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Partnerships Management
        </button>
        <button
          onClick={() => setActiveTab('tiers')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'tiers' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Creator Tiers
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 px-4 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'payouts' ? 'border-app-accent text-white' : 'border-transparent text-app-text-secondary hover:text-white'
          }`}
        >
          Payout Registers
        </button>
      </div>

      {/* SUB CONTENT VIEWS */}
      
      {/* 1. TELEMETRY & ATTRIBUTION TABLES/CHARTS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* VISUAL RECHARTS BLOCK */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1">
                <MousePointerClick className="w-4 h-4 text-[#EB4501]" /> Curated Recommendation conversions (Revenue vs Payout)
              </h3>
              <div className="h-64 text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={creatorCommissionChartData}>
                    <XAxis dataKey="name" stroke="#525252" tickLine={false} />
                    <YAxis stroke="#525252" tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#262626' }} />
                    <Legend />
                    <Bar dataKey="Generated Revenue BDT" fill="#1A1A2E" radius={[2,2,0,0]} />
                    <Bar dataKey="Paid out Commission" fill="#EB4501" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1">
                <Activity className="w-4 h-4 text-green-400" /> Daily Creator Telemetry aggregates (Phase 7 Warehouse data)
              </h3>
              <div className="h-64 text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={creatorDailyPerformanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
                    <XAxis dataKey="name" stroke="#525252" tickLine={false} />
                    <YAxis stroke="#525252" tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#262626' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Affiliate Clicks" stroke="#8B5CF6" strokeWidth={2} />
                    <Line type="monotone" dataKey="Conv Rate (%)" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ATTRIBUTION DATA LISTING TABLE */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Attribution Analytics Trace</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[10px] text-[#8E9BAE] font-mono uppercase tracking-wider">
                    <th className="py-2.5 pb-3">Curated Guide</th>
                    <th>Type</th>
                    <th>Owner / Creator</th>
                    <th>Views</th>
                    <th>Clicks</th>
                    <th>CTR</th>
                    <th>Conversions</th>
                    <th>Revenue BDT</th>
                    <th>Payout BDT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {recommendationMetrics.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.01]">
                      <td className="py-3 font-semibold text-white truncate max-w-xs">{r.title}</td>
                      <td className="uppercase font-mono text-[9px]">
                        <span className={`px-1.5 py-0.5 rounded-[2px] border ${
                          r.type === 'creator' ? 'bg-purple-500/10 text-purple-400 border-purple-500/15' : 'bg-slate-500/10 text-slate-400 border-slate-500/15'
                        }`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="font-medium text-slate-350">{r.owner_name}</td>
                      <td className="font-mono text-slate-400">{r.views.toLocaleString()}</td>
                      <td className="font-mono text-slate-400">{r.clicks.toLocaleString()}</td>
                      <td className="font-mono text-white font-bold">{getCTR(r.clicks, r.views)}</td>
                      <td className="font-mono text-slate-300 font-bold">{r.conversions}</td>
                      <td className="font-mono text-emerald-400 font-bold">৳{r.revenue.toLocaleString()}</td>
                      <td className="font-mono text-[#EB4501] font-bold">
                        {r.creator_earnings > 0 ? `৳${r.creator_earnings.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* INTERACTIVE CONVERSION SIMULATOR WORKBENCH */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <div className="border-b border-white/[0.04] pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Play className="w-4 h-4 text-green-400" /> Curated Link Attribution click / conversion simulation tool
              </h3>
              <p className="text-[10px] text-app-text-secondary">Simulate a buyer clicking or checking out from a creator guide to audit financial conversions live.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4 text-xs font-mono">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Select Curated Campaign</label>
                <select
                  value={selectedRecToSim}
                  onChange={(e) => setSelectedRecToSim(e.target.value)}
                  className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none"
                >
                  {recommendationMetrics.map(r => (
                    <option key={r.id} value={r.id}>{r.title} ({r.owner_name})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    logRecommendationActivity(selectedRecToSim, 'click');
                    alert('Attributed click registered! Clicks metric and click-through-ratio updated in table.');
                  }}
                  className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-4 py-2 rounded-[3px] cursor-pointer"
                >
                  Register Click Link
                </button>
                <button
                  onClick={() => {
                    logRecommendationActivity(selectedRecToSim, 'conversion');
                    alert('Buyer Checkout fully converted! Revenue generated, and affiliate payouts registered instantly.');
                  }}
                  className="flex-1 sm:flex-initial bg-[#EB4501] hover:bg-app-accent-light text-white font-bold px-4 py-2 rounded-[3px] cursor-pointer"
                >
                  Register checkout conversion
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. CAMPAGINS SUB-TAB */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white/[0.01] border border-white/[0.03] p-4 rounded-[4px]">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Brand campaign registry</h3>
              <p className="text-[10px] text-app-text-secondary">Track flat-fee budgets and commission payouts matching active retail brands.</p>
            </div>
            
            <button
              onClick={() => setShowCampaignForm(!showCampaignForm)}
              className="bg-[#EB4501] hover:bg-app-accent-light text-white font-bold text-xs px-3 py-1.5 rounded-[2px] leading-none cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Assemble campaign
            </button>
          </div>

          {/* Form wrapper */}
          {showCampaignForm && (
            <form onSubmit={handleCampaignSubmit} className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-4 text-xs font-mono">
              <div className="md:col-span-3 space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Campaign name</label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Silk Panjabi Drive..."
                  className="w-full bg-white/[0.02] border border-app-border p-2 text-white rounded-[3px]"
                  required
                />
              </div>

              <div className="md:col-span-3 space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Filing Brand</label>
                <select
                  value={`${campaignBrandId}:${campaignBrandName}`}
                  onChange={(e) => {
                    const [id, name] = e.target.value.split(':');
                    setCampaignBrandId(id);
                    setCampaignBrandName(name);
                  }}
                  className="w-full bg-slate-900 border border-app-border p-2 text-white rounded-[3px]"
                >
                  <option value="brand_aarong:Aarong Handcrafts">Aarong Handcrafts</option>
                  <option value="brand_apex:Apex Footwear">Apex Footwear</option>
                  <option value="brand_walton:Walton Appliances">Walton Appliances</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Budget flat (BDT)</label>
                <input
                  type="number"
                  value={campaignBudget}
                  onChange={(e) => setCampaignBudget(parseInt(e.target.value))}
                  className="w-full bg-white/[0.02] border border-app-border p-2 text-white rounded-[3px]"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Affiliate Rate %</label>
                <input
                  type="number"
                  value={campaignRate}
                  onChange={(e) => setCampaignRate(parseInt(e.target.value))}
                  className="w-full bg-white/[0.02] border border-app-border p-2 text-white rounded-[3px]"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full bg-green-650 hover:bg-green-600 text-white font-extrabold uppercase py-2 tracking-wider rounded-[3px] cursor-pointer"
                >
                  Dispatch Campaign
                </button>
              </div>
            </form>
          )}

          {/* Campaigns listing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {campaigns.map(cp => (
              <div key={cp.id} className="bg-app-card border border-app-border rounded-[4px] p-4.5 space-y-3 relative overflow-hidden shadow-2xl">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">{cp.title}</h4>
                    <span className="text-[10px] text-app-text-secondary font-mono">{cp.brand_name}</span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-[2px] text-[8px] font-bold uppercase tracking-wider border ${
                    cp.active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/15'
                  }`}>
                    {cp.active ? 'Active live' : 'In sleep'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-white/[0.03] py-2.5 font-mono text-[10px]">
                  <div>
                    <span className="text-slate-500 block">BUDGET TOTAL:</span>
                    <span className="text-white font-bold">৳{cp.budget.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">COMMISSION:</span>
                    <span className="text-app-accent-light font-bold flex items-center gap-0.5 font-sans">
                      <Percent className="w-3.5 h-3.5" /> {cp.commission_rate}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10.5px] text-app-text-secondary">
                  <span>Clicks: <strong className="text-white">{cp.clicks}</strong></span>
                  <span>Conversions: <strong className="text-green-400">৳{cp.revenue.toLocaleString()}</strong></span>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* 3. PARTNERSHIPS SUB-TAB */}
      {activeTab === 'partnerships' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">Active brand partnerships</h3>
            
            <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
              {partnerships.map(pt => (
                <div key={pt.id} className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full h-10 w-10 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-sans font-bold text-white text-xs">{pt.creator_name}</h4>
                      <p className="text-[10px] text-app-text-secondary font-mono">Matched Brand target: <strong className="text-white">{pt.brand_name}</strong></p>
                      <span className="text-[9px] text-slate-500 block font-mono">Affiliate sales: ৳{pt.revenue_generated.toLocaleString()} BDT</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-[2px] text-[8px] font-bold uppercase tracking-wider border ${
                      pt.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-505 border-yellow-500/20'
                    }`}>
                      {pt.status}
                    </span>

                    {pt.status === 'Pending' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updatePartnershipStatus(pt.id, 'Active')}
                          className="px-2 py-1 bg-green-550 hover:bg-green-500 text-white font-bold font-mono text-[9px] rounded-[2px] cursor-pointer"
                        >
                          Approve Terms
                        </button>
                        <button
                          onClick={() => updatePartnershipStatus(pt.id, 'Terminated')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-[9px] rounded-[2px] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PROPOSE FORM COLUMN */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">Propose commercial partnership</h3>
            
            <form onSubmit={handleProposePartnershipSubmit} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Target creator</label>
                <select
                  value={`${creatorPId}:${creatorPName}`}
                  onChange={(e) => {
                    const [id, name] = e.target.value.split(':');
                    setCreatorPId(id);
                    setCreatorPName(name);
                  }}
                  className="w-full bg-slate-900 border border-app-border p-2 text-white rounded-[3px]"
                >
                  <option value="creator_rafsan:Rafsan The Chotobhai">Rafsan The Chotobhai</option>
                  <option value="creator_khalid:Khalid Farhan">Khalid Farhan</option>
                  <option value="creator_tawhid:Tawhid Afridi">Tawhid Afridi</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Affiliated Retail corporators</label>
                <select
                  value={`${brandPId}:${brandPName}`}
                  onChange={(e) => {
                    const [id, name] = e.target.value.split(':');
                    setBrandPId(id);
                    setBrandPName(name);
                  }}
                  className="w-full bg-slate-900 border border-app-border p-2 text-white rounded-[3px]"
                >
                  <option value="brand_aarong:Aarong Handcrafts">Aarong Handcrafts</option>
                  <option value="brand_apex:Apex Footwear">Apex Footwear</option>
                  <option value="brand_walton:Walton Appliances">Walton Appliances</option>
                </select>
              </div>

              <div className="p-3 bg-white/[0.01] border border-white/[0.03] text-[10.5px] text-[#8E9BAE] leading-normal rounded-[3px]">
                Sends digital invitation to corporate brands in-app messenger threads instantly. Default agreement templates apply.
              </div>

              <button
                type="submit"
                className="w-full bg-[#EB4501] hover:bg-app-accent-light text-white font-bold py-2 rounded-[3px] cursor-pointer"
              >
                Send partnership invitation
              </button>
            </form>
          </div>

        </div>
      )}

      {/* 4. CREATOR TIERS SUB-TAB */}
      {activeTab === 'tiers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
          {creatorTiers.map(tier => (
            <div key={tier.id} className="bg-app-card border border-app-border rounded-[4px] p-5.5 space-y-4 relative overflow-hidden shadow-2xl flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-white text-base">{tier.name}</h4>
                    <span className="text-[10px] uppercase font-mono text-slate-500">Min. reputation events score: {tier.min_points} pt</span>
                  </div>
                  <Award className="w-6 h-6 text-yellow-400 rotate-12" />
                </div>

                <div className="p-3 bg-white/[0.01] rounded-[3px] border border-white/[0.02] text-xs font-mono text-slate-350">
                  <span className="text-[9px] text-[#8E9BAE] block uppercase font-extrabold">Attribution margin boost:</span>
                  <span className="text-white font-extrabold text-sm font-sans flex items-center">
                    +{tier.commission_boost}% commission multipliers BDT
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider block">Exclusive Perks:</span>
                  <ul className="space-y-1.5 text-xs text-app-text-secondary leading-relaxed">
                    {tier.perks.map((p, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.03] mt-3 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Tier id: {tier.id}</span>
                <span>Audit Verified lock</span>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* 5. PAYOUT REGISTERS */}
      {activeTab === 'payouts' && (
        <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">Digital affiliate payout registers</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] text-[10px] text-[#8E9BAE] font-mono uppercase tracking-wider">
                  <th className="py-2.5 pb-3">Payee Creator</th>
                  <th>Amount Due</th>
                  <th>Payment Method channel</th>
                  <th>Filing date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] font-mono">
                {creatorPayouts.map(po => (
                  <tr key={po.id} className="hover:bg-white/[0.01]">
                    <td className="py-3 font-sans font-bold text-white">{po.creator_name}</td>
                    <td className="font-bold text-emerald-400">৳{po.amount.toLocaleString()}</td>
                    <td className="text-slate-350">{po.channel}</td>
                    <td className="text-slate-500">{new Date(po.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded-[2px] text-[8.5px] uppercase border font-bold ${
                        po.status === 'paid' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-501 border-yellow-500/20'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td>
                      {po.status === 'pending' ? (
                        <button
                          onClick={() => {
                            processCreatorPayout(po.id);
                            alert(`Affiliate funds has been cleared and dispatched via ${po.channel}!`);
                          }}
                          className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[9px] font-bold uppercase rounded-[2px] cursor-pointer"
                        >
                          Clear payment
                        </button>
                      ) : (
                        <span className="text-green-500 text-[10px]">✓ Cleared audit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
