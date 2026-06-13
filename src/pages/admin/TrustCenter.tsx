import React, { useState, useMemo } from 'react';
import { useTrust, TrustEntityType, TrustEventType, TrustAlert_Type, SeverityType, ReputationLedgerEntry } from '../../contexts/TrustContext';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HelpCircle, 
  ChevronRight, 
  Activity, 
  Layers, 
  Bell, 
  Play, 
  Check, 
  X, 
  Eye, 
  Plus, 
  User, 
  Award, 
  Building2, 
  Users, 
  ShoppingBag,
  Sliders,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid
} from 'recharts';

export default function TrustCenter() {
  const {
    reputationLedger,
    trustScores,
    trustScoreSnapshots,
    trustAlerts,
    addTrustEvent,
    resolveTrustAlert,
    generateTrustAlert,
    dailyPlatformMetrics
  } = useTrust();

  // Selected Entity state for detail breakdown & timeline
  const [selectedEntityId, setSelectedEntityId] = useState<string>('brand_aarong');
  const [selectedEntityType, setSelectedEntityType] = useState<TrustEntityType>('brand');
  
  // Modal state for Trust Score Breakdown
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownEntityId, setBreakdownEntityId] = useState<string | null>(null);
  const [breakdownEntityType, setBreakdownEntityType] = useState<TrustEntityType>('brand');

  // Interactive Live simulation helper states
  const [simEntityType, setSimEntityType] = useState<TrustEntityType>('brand');
  const [simEntityId, setSimEntityId] = useState<string>('brand_aarong');
  const [simEntityName, setSimEntityName] = useState<string>('Aarong Handcrafts');
  const [simEventType, setSimEventType] = useState<TrustEventType>('review_verified');
  const [simPoints, setSimPoints] = useState<number>(5);
  const [simReason, setSimReason] = useState<string>('Eid review validation passed');

  // Filter alerts state
  const [alertsFilter, setAlertsFilter] = useState<'All' | 'unresolved' | 'resolved'>('unresolved');

  // Entity Map for human convenience
  const entityNameMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {
      'brand_aarong': 'Aarong Handcrafts',
      'brand_apex': 'Apex Footwear',
      'brand_walton': 'Walton Appliances',
      'seller_techzone': 'TechZone BD',
      'creator_rafsan': 'Rafsan The Chotobhai',
      'cust_003': 'Nadia Akter'
    };
    return map;
  }, []);

  const selectedEntityName = useMemo(() => {
    return entityNameMap[selectedEntityId] || selectedEntityId;
  }, [selectedEntityId, entityNameMap]);

  // Handle entity selector change
  const handleEntitySelect = (entityId: string, entityType: TrustEntityType) => {
    setSelectedEntityId(entityId);
    setSelectedEntityType(entityType);
  };

  // Human friendly labels for ledger event codes
  const getEventLabelAndColor = (type: TrustEventType) => {
    switch(type) {
      case 'order_delivered': 
        return { label: 'Successful Delivery', bg: 'bg-green-500/10 text-green-400 border-green-500/20', scoreSign: '+' };
      case 'review_verified': 
        return { label: 'Verified Review Approved', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', scoreSign: '+' };
      case 'complaint_resolved': 
        return { label: 'Complaint Resolved Sustainably', bg: 'bg-teal-500/10 text-teal-400 border-teal-500/20', scoreSign: '+' };
      case 'review_removed': 
        return { label: 'Misleading Review Removed', bg: 'bg-orange-500/10 text-orange-400 border-orange-500/20', scoreSign: '-' };
      case 'complaint_received': 
        return { label: 'Buyer Complaint Handed Over', bg: 'bg-red-500/10 text-red-400 border-red-500/20', scoreSign: '-' };
      case 'fake_review_detected': 
        return { label: 'Fake Interaction Algorithmic Flag', bg: 'bg-red-600/10 text-red-500 border-red-600/20', scoreSign: '-' };
      case 'account_suspended': 
        return { label: 'Audit Suspension Status Pub', bg: 'bg-[#EB4501]/10 text-app-accent-light border-[#EB4501]/20', scoreSign: '-' };
      case 'cancellation_rate_high': 
        return { label: 'Abnormal Checkout Cancellations', bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', scoreSign: '-' };
      case 'return_rate_high': 
        return { label: 'Post-delivery Return Breach', bg: 'bg-amber-600/10 text-amber-500 border-amber-600/20', scoreSign: '-' };
      case 'delivery_failure': 
        return { label: 'Courier Handover Failure', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', scoreSign: '-' };
      case 'creator_violation': 
        return { label: 'Creator Compliance Warning', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', scoreSign: '-' };
      default: 
        return { label: 'Reputation Interaction Updated', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', scoreSign: '' };
    }
  };

  // ============================================================================
  // PHASE 2 METRICS CALCULATION
  // ============================================================================
  const stats = useMemo(() => {
    const brands = trustScores.filter(s => s.entity_type === 'brand');
    const sellers = trustScores.filter(s => s.entity_type === 'seller');
    const creators = trustScores.filter(s => s.entity_type === 'creator');
    const buyers = trustScores.filter(s => s.entity_type === 'buyer');

    const brandAvg = brands.length ? Math.round(brands.reduce((sum, s) => sum + s.current_score, 0) / brands.length) : 100;
    const sellerAvg = sellers.length ? Math.round(sellers.reduce((sum, s) => sum + s.current_score, 0) / sellers.length) : 100;
    const creatorAvg = creators.length ? Math.round(creators.reduce((sum, s) => sum + s.current_score, 0) / creators.length) : 100;
    const buyerAvg = buyers.length ? Math.round(buyers.reduce((sum, s) => sum + s.current_score, 0) / buyers.length) : 100;

    return { brandAvg, sellerAvg, creatorAvg, buyerAvg };
  }, [trustScores]);

  // ============================================================================
  // CHART 1: TRUST TREND (RECHARTS AREA CHART)
  // ============================================================================
  const trendChartData = useMemo(() => {
    // Generate daily points
    return dailyPlatformMetrics.map(d => ({
      name: d.date,
      'Averaged Operating Trust': d.avg_trust_score,
      'Total Transactions': Math.round(d.total_revenue / 1000)
    }));
  }, [dailyPlatformMetrics]);

  // ============================================================================
  // CHART 2: TRUST SCORE DISTRIBUTION
  // ============================================================================
  const distributionChartData = useMemo(() => {
    const ranges = [
      { range: '90-100 Premium', count: 0 },
      { range: '80-89 Stable', count: 0 },
      { range: '70-79 At Risk', count: 0 },
      { range: 'Below 70 Penalized', count: 0 }
    ];

    trustScores.forEach(s => {
      if (s.current_score >= 90) ranges[0].count++;
      else if (s.current_score >= 80) ranges[1].count++;
      else if (s.current_score >= 70) ranges[2].count++;
      else ranges[3].count++;
    });

    return ranges;
  }, [trustScores]);

  // ============================================================================
  // CHART 3: TRUST EVENTS BY TYPE (PIE CHART)
  // ============================================================================
  const eventPieChartData = useMemo(() => {
    const types: Record<string, number> = {};
    reputationLedger.forEach(l => {
      const friendlyName = getEventLabelAndColor(l.event_type).label;
      types[friendlyName] = (types[friendlyName] || 0) + 1;
    });

    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [reputationLedger]);

  const COLORS = ['#10B981', '#1A1A2E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  // ============================================================================
  // TRUST TIMELINE FOR SELECTED ENTITY
  // ============================================================================
  const filteredTimeline = useMemo(() => {
    return reputationLedger
      .filter(l => l.entity_id === selectedEntityId && l.entity_type === selectedEntityType)
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reputationLedger, selectedEntityId, selectedEntityType]);

  // Selected Entity score breakdowns
  const activeBreakdown = useMemo(() => {
    const scores = trustScores.find(s => s.entity_id === (breakdownEntityId || selectedEntityId) && s.entity_type === (breakdownEntityType || selectedEntityType));
    return scores || {
      quality: 90,
      delivery: 90,
      service: 90,
      returns: 90,
      complaints: 90,
      recommendations: 90,
      current_score: 90,
      entity_name: 'Unknown Node'
    };
  }, [trustScores, breakdownEntityId, selectedEntityId, breakdownEntityType, selectedEntityType]);

  // Actionable Alerts List processed
  const processedAlerts = useMemo(() => {
    if (alertsFilter === 'All') return trustAlerts;
    return trustAlerts.filter(a => a.status === alertsFilter);
  }, [trustAlerts, alertsFilter]);

  // Submit Interactive Simulator Event
  const triggerSimulationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTrustEvent(
      simEntityType,
      simEntityId,
      simEntityName,
      simEventType,
      simPoints,
      { details: simReason }
    );
    setSelectedEntityId(simEntityId);
    setSelectedEntityType(simEntityType);
  };

  // Map simulated type options
  const handleSimTypeChange = (type: TrustEntityType) => {
    setSimEntityType(type);
    if (type === 'brand') {
      setSimEntityId('brand_aarong');
      setSimEntityName('Aarong Handcrafts');
    } else if (type === 'seller') {
      setSimEntityId('seller_techzone');
      setSimEntityName('TechZone BD');
    } else if (type === 'creator') {
      setSimEntityId('creator_rafsan');
      setSimEntityName('Rafsan The Chotobhai');
    } else {
      setSimEntityId('cust_003');
      setSimEntityName('Nadia Akter');
    }
  };

  const getAlertSeverityColor = (sev: SeverityType) => {
    switch(sev) {
      case 'Critical': return 'bg-red-650/10 text-red-400 border-red-500/30 font-bold';
      case 'High': return 'bg-[#EB4501]/10 text-app-accent-light border-[#EB4501]/20 font-bold';
      case 'Medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
    }
  };

  return (
    <div className="space-y-6 pb-12 transition-all animate-in fade-in duration-300 text-app-text-primary">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <span>Operating Node</span>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">Trust-First Operating System</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-app-accent-light" /> Trust Engine Control Center
          </h1>
          <p className="text-app-text-secondary text-[12px]">
            Comprehensive decentralized auditable score ledger mapping reputation weights across Brands, Sellers, Creators, and Buyers.
          </p>
        </div>
        
        {/* Verification Status Banner */}
        <div className="flex items-center gap-2.5 bg-green-500/15 border border-green-550/20 rounded-[4px] px-3.5 py-1.5 self-start md:self-auto text-green-400 uppercase font-mono text-[10px] font-bold tracking-widest">
          <CheckCircle2 className="w-4 h-4 text-green-400 animate-pulse" />
          <span>Ledger Safe & Synchronized</span>
        </div>
      </div>

      {/* FOUR CORNER AVERAGED METRICS - PHASE 2 MAPPED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl space-y-1 relative group hover:border-app-accent/30 transition-all">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Brand Trust Average</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{stats.brandAvg}%</span>
            <span className="text-[11px] font-bold text-green-500 font-mono flex items-center gap-0.5 mb-1 bg-green-500/10 px-1.5 py-0.5 rounded-[2px]">
              <TrendingUp className="w-3 h-3" /> +1.2%
            </span>
          </div>
          <p className="text-[10px] text-slate-500">Corporate verification standard active</p>
          <Building2 className="absolute right-4 top-4 w-7 h-7 text-slate-500/10 group-hover:text-app-accent/10 transition-colors" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl space-y-1 relative group hover:border-app-accent/30 transition-all">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Seller Trust Average</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{stats.sellerAvg}%</span>
            <span className="text-[11px] font-bold text-[#EB4501] font-mono flex items-center gap-0.5 mb-1 bg-red-500/10 px-1.5 py-0.5 rounded-[2px]">
              -0.4%
            </span>
          </div>
          <p className="text-[10px] text-slate-500">Includes wholesale/merchant fulfillment metrics</p>
          <ShoppingBag className="absolute right-4 top-4 w-7 h-7 text-slate-500/10 group-hover:text-app-accent/10 transition-colors" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl space-y-1 relative group hover:border-app-accent/30 transition-all">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Creator Trust Average</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{stats.creatorAvg}%</span>
            <span className="text-[11px] font-bold text-green-500 font-mono flex items-center gap-0.5 mb-1 bg-green-500/10 px-1.5 py-0.5 rounded-[2px]">
              <TrendingUp className="w-3 h-3" /> +2.0%
            </span>
          </div>
          <p className="text-[10px] text-slate-500">Performance campaigns verified attribution</p>
          <Award className="absolute right-4 top-4 w-7 h-7 text-slate-500/10 group-hover:text-app-accent/10 transition-colors" />
        </div>

        <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl space-y-1 relative group hover:border-app-accent/30 transition-all">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">Buyer Trust Average</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{stats.buyerAvg}%</span>
            <span className="text-[11px] font-bold text-green-500 font-mono flex items-center gap-0.5 mb-1 bg-green-500/10 px-1.5 py-0.5 rounded-[2px]">
              Stable
            </span>
          </div>
          <p className="text-[10px] text-slate-500">Safeguards against delivery and cancellation abuse</p>
          <Users className="absolute right-4 top-4 w-7 h-7 text-slate-500/10 group-hover:text-app-accent/10 transition-colors" />
        </div>

      </div>

      {/* THREE INTERACTIVE CHARTS WRAPPERS - PHASE 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART 1: TRUST TREND AREA CHART */}
        <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Averaged Trust Trend Line</h3>
              <p className="text-[10px] text-app-text-secondary">Chronological evolution of platform trust parameters plotted daily.</p>
            </div>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="h-64 mt-4 text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrust" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#525252" tickLine={false} />
                <YAxis domain={[50, 100]} stroke="#525252" tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', borderColor: '#262626' }} 
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }} 
                />
                <CartesianGrid strokeDasharray="3 3" opacity={0.05} />
                <Area type="monotone" dataKey="Averaged Operating Trust" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTrust)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2 & 3 COLUMNS */}
        <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Trust Score Distribution</h3>
              <p className="text-[10px] text-app-text-secondary">Active participants categorizations based on direct performance weights.</p>
            </div>
            <Layers className="w-4 h-4 text-app-accent-light" />
          </div>

          <div className="h-44 font-mono text-[9px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionChartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <XAxis dataKey="range" stroke="#525252" tickLine={false} />
                <YAxis stroke="#525252" tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', borderColor: '#262626' }}
                />
                <Bar dataKey="count" fill="#EB4501" radius={[2, 2, 0, 0]}>
                  {distributionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-white/[0.04] pt-2 flex justify-between items-center text-[10px] font-mono">
            <span>Overall Ledger Active:</span>
            <span className="font-bold text-white">{trustScores.length} nodes indexed</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* TRUST TIMELINE VIEWER & BREAKDOWN FOCUS SELECTOR (LEFT 8 COLS) */}
        <div className="lg:col-span-8 bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-app-accent" /> Node Trace Timeline & Score Breakdown
              </h2>
              <p className="text-[10px] text-app-text-secondary">Select any active marketplace participant node to trace reputation variables.</p>
            </div>

            {/* Select dropdown targeting entities */}
            <select 
              value={`${selectedEntityType}:${selectedEntityId}`}
              onChange={(e) => {
                const [type, id] = e.target.value.split(':');
                handleEntitySelect(id, type as TrustEntityType);
              }}
              className="bg-app-card border border-app-border rounded-[4px] px-3 py-1.5 text-xs text-white focus:outline-none focus:border-app-accent/50 cursor-pointer text-left"
            >
              <optgroup label="Brands (Verified)">
                <option value="brand:brand_aarong">Aarong Handcrafts</option>
                <option value="brand:brand_apex">Apex Footwear</option>
                <option value="brand:brand_walton">Walton Appliances</option>
              </optgroup>
              <optgroup label="Retail Merchants">
                <option value="seller:seller_techzone">TechZone BD (Merchant)</option>
              </optgroup>
              <optgroup label="Creators (Verifications)">
                <option value="creator:creator_rafsan">Rafsan The Chotobhai</option>
              </optgroup>
              <optgroup label="Buyers (Audited)">
                <option value="buyer:cust_003">Nadia Akter (Flagged Risk)</option>
              </optgroup>
            </select>
          </div>

          {/* SPLIT SCREEN INSIDE TAB */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* SUBSECTION A: CURRENT BREAKDOWN CARD (4 COLS) */}
            <div className="md:col-span-4 bg-white/[0.01] border border-white/[0.03] rounded-[4px] p-4 flex flex-col justify-between space-y-4">
              <div className="text-center space-y-1.5">
                <span className="text-[9px] text-[#8E9BAE] font-extrabold uppercase tracking-widest block">Trust Index</span>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-500/10 border border-slate-500/15">
                  <span className={`text-xl font-black font-mono ${
                    activeBreakdown.current_score >= 90 ? 'text-green-400' :
                    activeBreakdown.current_score >= 80 ? 'text-blue-400' :
                    activeBreakdown.current_score >= 70 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {activeBreakdown.current_score}
                  </span>
                </div>
                <h4 className="font-bold text-white text-xs truncate">{selectedEntityName}</h4>
                <p className="text-[9px] uppercase tracking-wider text-slate-500">{selectedEntityType} profile</p>
              </div>

              {/* Quality, Delivery, Service, Returns, Complaints, Recommendations */}
              <div className="space-y-2 text-[10px] font-mono">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quality:</span>
                    <span className="text-white font-bold">{activeBreakdown.quality}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${activeBreakdown.quality}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivery:</span>
                    <span className="text-white font-bold">{activeBreakdown.delivery}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${activeBreakdown.delivery}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer Service:</span>
                    <span className="text-white font-bold">{activeBreakdown.service}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${activeBreakdown.service}%` }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setBreakdownEntityId(selectedEntityId);
                  setBreakdownEntityType(selectedEntityType);
                  setShowBreakdownModal(true);
                }}
                className="w-full bg-[#EB4501] hover:bg-app-accent-light text-white text-[10px] font-bold py-1.5 rounded-[2px] cursor-pointer transition-colors"
              >
                Inquire Logic Trace
              </button>
            </div>

            {/* SUBSECTION B: CHRONOLOGICAL TRUST EVENTS TIMELINE VIEWER (8 COLS) */}
            <div className="md:col-span-8 space-y-3.5">
              <h3 className="text-[10px] font-bold text-[#8E9BAE] uppercase tracking-widest">
                Verification reputational logs ({filteredTimeline.length})
              </h3>

              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {filteredTimeline.length > 0 ? (
                  filteredTimeline.map((item, idx) => {
                    const eventConfig = getEventLabelAndColor(item.event_type);
                    return (
                      <div key={item.id} className="p-3 bg-white/[0.01] border border-white/[0.03] rounded-[4px] relative pl-12 transition-all hover:bg-white/[0.02]">
                        {/* Bullet indicators */}
                        <div className={`absolute left-3.5 top-3.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          item.points >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {item.points >= 0 ? `+${item.points}` : item.points}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className={`px-2 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider self-start sm:self-auto border ${eventConfig.bg}`}>
                            {eventConfig.label}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="mt-1.5 text-xs text-white/95 font-medium leading-relaxed">
                          {JSON.parse(item.metadata_json)?.details || JSON.parse(item.metadata_json)?.reason || 'Automated trust point modification.'}
                        </div>
                        <span className="text-[8.5px] font-mono text-slate-500 mt-0.5 block">Audit Event: {item.id}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
                    <HelpCircle className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-white">No auditable log entries found</p>
                    <p className="text-[10px]">Simulate a transaction using the Interactive Sandbox below.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ACTIVE TRUST ALERTS TABLE COLUMN (RIGHT 4 COLS) */}
        <div className="lg:col-span-4 bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Trust Alerts</h3>
                <p className="text-[10px] text-app-text-secondary">Automated security triggers currently active.</p>
              </div>
              <Bell className="w-4 h-4 text-yellow-400 animate-bounce" />
            </div>

            {/* Filter alerts keys */}
            <div className="flex gap-1.5">
              {(['unresolved', 'resolved', 'All'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAlertsFilter(tab)}
                  className={`px-2.5 py-1 text-[9px] font-extrabold uppercase select-none rounded-[2px] border cursor-pointer ${
                    alertsFilter === tab
                      ? 'bg-app-accent border-app-accent text-white'
                      : 'bg-white/5 border-transparent text-app-text-secondary hover:text-white'
                  }`}
                >
                  {tab === 'unresolved' ? 'Active' : tab}
                </button>
              ))}
            </div>

            {/* Simulated alert listing row */}
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto custom-scrollbar">
              {processedAlerts.length > 0 ? (
                processedAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-[4px] space-y-2 relative">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-white text-xs">{alert.alert_type}</h4>
                        <span className="text-[9px] text-app-text-secondary block font-mono">{alert.entity_name} ({alert.entity_type})</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-[2px] text-[8px] tracking-wider uppercase border ${getAlertSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>

                    <p className="text-[11px] text-app-text-secondary/90 leading-normal">{alert.message}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.02] text-[9px] font-mono">
                      <span className="text-slate-500">{new Date(alert.created_at).toLocaleDateString()}</span>
                      
                      {alert.status === 'unresolved' ? (
                        <button
                          onClick={() => {
                            resolveTrustAlert(alert.id);
                            addTrustEvent(alert.entity_type, alert.entity_id, alert.entity_name, 'complaint_resolved', 10, { reason: `Resolved escalation: ${alert.alert_type}` });
                          }}
                          className="text-green-400 hover:text-green-300 font-bold hover:underline cursor-pointer uppercase flex items-center gap-0.5"
                        >
                          <Check className="w-3 h-3" /> Dismiss Alert
                        </button>
                      ) : (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                          ✓ Dismissed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-app-text-secondary border border-dashed border-app-border rounded-[4px]">
                  <CheckCircle2 className="w-6 h-6 opacity-20 mx-auto mb-1 text-green-400" />
                  <p className="text-[11px] font-bold text-white">All alerts resolved</p>
                  <p className="text-[9.5px]">No critical security/trust violations are pending.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-[3px] flex items-start gap-2.5">
            <div className="p-1 bg-yellow-500/10 text-yellow-400 rounded-full mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] text-yellow-400 leading-normal">
              <strong>Enterprise Warning Limit:</strong> Trust levels dropping below 70B BDT trigger review flags in the merchant dashboard automatically.
            </p>
          </div>
        </div>

      </div>

      {/* REPUTATION LEDGER ACTIVE INJECTION SIMULATOR */}
      <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-2xl space-y-4">
        <div className="border-b border-white/[0.04] pb-2">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Play className="w-4 h-4 text-app-accent-light" /> Interactive Trust Ledger Sandbox
          </h2>
          <p className="text-[10px] text-app-text-secondary">Simulate live transaction reports or moderation outputs to check automatic trust recalculation traces in real time.</p>
        </div>

        <form onSubmit={triggerSimulationSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs font-mono">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Target Role</label>
            <select
              value={simEntityType}
              onChange={(e) => handleSimTypeChange(e.target.value as TrustEntityType)}
              className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none"
            >
              <option value="brand">Brand (Corporate)</option>
              <option value="seller">Seller (Merchant)</option>
              <option value="creator">Creator (Partner)</option>
              <option value="buyer">Buyer (Customer)</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Entity Node</label>
            <select
              value={simEntityId}
              onChange={(e) => {
                setSimEntityId(e.target.value);
                setSimEntityName(e.target.options[e.target.selectedIndex].text);
              }}
              className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none"
            >
              {simEntityType === 'brand' && (
                <>
                  <option value="brand_aarong">Aarong Handcrafts</option>
                  <option value="brand_apex">Apex Footwear</option>
                  <option value="brand_walton">Walton Appliances</option>
                </>
              )}
              {simEntityType === 'seller' && (
                <option value="seller_techzone">TechZone BD</option>
              )}
              {simEntityType === 'creator' && (
                <option value="creator_rafsan">Rafsan The Chotobhai</option>
              )}
              {simEntityType === 'buyer' && (
                <option value="cust_003">Nadia Akter</option>
              )}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Trigger Event Type</label>
            <select
              value={simEventType}
              onChange={(e) => {
                setSimEventType(e.target.value as TrustEventType);
                // default weight recommendations
                const optWeights: Record<string, number> = {
                  'order_delivered': 3,
                  'review_verified': 5,
                  'review_removed': -10,
                  'complaint_received': -15,
                  'complaint_resolved': 10,
                  'fake_review_detected': -20,
                  'account_suspended': -35,
                  'cancellation_rate_high': -15,
                  'return_rate_high': -12,
                  'creator_violation': -10,
                  'delivery_failure': -8
                };
                setSimPoints(optWeights[e.target.value] || 5);
              }}
              className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none"
            >
              <option value="order_delivered">order_delivered (+3)</option>
              <option value="review_verified">review_verified (+5)</option>
              <option value="complaint_resolved">complaint_resolved (+10)</option>
              <option value="review_removed">review_removed (-10)</option>
              <option value="complaint_received">complaint_received (-15)</option>
              <option value="fake_review_detected">fake_review_detected (-20)</option>
              <option value="account_suspended">account_suspended (-35)</option>
              <option value="cancellation_rate_high">cancellation_rate_high (-15)</option>
              <option value="return_rate_high">return_rate_high (-12)</option>
              <option value="creator_violation">creator_violation (-10)</option>
              <option value="delivery_failure">delivery_failure (-8)</option>
            </select>
          </div>

          <div className="md:col-span-1 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Net Weight</label>
            <input
              type="number"
              value={simPoints}
              onChange={(e) => setSimPoints(parseInt(e.target.value))}
              className="w-full bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white text-center font-bold focus:outline-none"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E9BAE]">Reason / Message Ledger</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={simReason}
                onChange={(e) => setSimReason(e.target.value)}
                placeholder="Incident note details for auditing..."
                className="flex-1 bg-white/[0.02] border border-app-border rounded-[3px] p-2 text-white focus:outline-none"
                required
              />
              <button
                type="submit"
                className="bg-[#EB4501] hover:bg-app-accent-light text-white font-bold px-4 py-2 rounded-[3px] cursor-pointer"
              >
                Inject Event
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* PHASE 2 SCORES DETAILED EXPLAINABILITY TRACE MODAL */}
      {showBreakdownModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-[8px] max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 text-xs text-app-text-primary">
            <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-app-accent-light" />
                <h3 className="font-bold text-white text-base">Trust Trace Auditable Breakdown</h3>
              </div>
              <button 
                onClick={() => setShowBreakdownModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-[3px] space-y-1">
              <div className="flex justify-between font-bold">
                <span className="text-white">Selected Node Target:</span>
                <span className="text-app-accent-light font-mono italic">{activeBreakdown.entity_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Calculated System Score:</span>
                <span className="font-bold text-white font-mono">{activeBreakdown.current_score} / 100</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#8E9BAE]">
                <span>Last Updated Code:</span>
                <span>{new Date().toISOString()}</span>
              </div>
            </div>

            <div className="space-y-3.5">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Explanation of Trace Weights</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1 p-2 bg-white/[0.01] rounded-[3px] border border-white/[0.02]">
                  <span className="text-white font-bold block">1. Product Quality Index</span>
                  <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                    <span className="text-slate-500">Calculated value:</span>
                    <span className="text-green-400 font-bold">{activeBreakdown.quality}%</span>
                  </div>
                  <p className="text-[10px] text-app-text-secondary leading-normal">
                    Derived from audited positive ratings of physical products or content endorsements. Removed fake review entries deduct -25 weight.
                  </p>
                </div>

                <div className="space-y-1 p-2 bg-white/[0.01] rounded-[3px] border border-white/[0.02]">
                  <span className="text-white font-bold block">2. Delivery Logistics Factor</span>
                  <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                    <span className="text-slate-500">Calculated value:</span>
                    <span className="text-blue-400 font-bold">{activeBreakdown.delivery}%</span>
                  </div>
                  <p className="text-[10px] text-app-text-secondary leading-normal">
                    Measures successful courier handovers. Every courier return or delivery failure triggers a negative ledger weight of -8.
                  </p>
                </div>

                <div className="space-y-1 p-2 bg-white/[0.01] rounded-[3px] border border-white/[0.02]">
                  <span className="text-white font-bold block">3. Customer Service Score</span>
                  <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                    <span className="text-slate-500">Calculated value:</span>
                    <span className="text-teal-400 font-bold">{activeBreakdown.service}%</span>
                  </div>
                  <p className="text-[10px] text-app-text-secondary leading-normal">
                    Monitors customer complaints and resolutions. Complaint resolve events immediately restore +10 base trust weight.
                  </p>
                </div>

                <div className="space-y-1 p-2 bg-white/[0.01] rounded-[3px] border border-white/[0.02]">
                  <span className="text-white font-bold block">4. Secure Returns Gate</span>
                  <div className="flex justify-between items-center text-[10px] mb-1 font-mono">
                    <span className="text-slate-500">Calculated value:</span>
                    <span className="text-[#EB4501] font-bold">{activeBreakdown.returns}%</span>
                  </div>
                  <p className="text-[10px] text-app-text-secondary leading-normal">
                    Weighted ratio of standard returns versus forced chargebacks. Protects the node against fraud checkout spam.
                  </p>
                </div>

              </div>
            </div>

            <div className="bg-emerald-550/10 border border-emerald-500/20 p-3 rounded-[4px] font-mono text-[10.5px] text-emerald-400 leading-normal">
              <strong>Mathematical Audit Trace:</strong> Current Score = Base (90) + SumOf(Reputation Ledgers Points). Current active sum of points: {activeBreakdown.current_score - 90}. Fully traceable, non-obfuscated.
            </div>

            <div className="flex justify-end pt-2 border-t border-white/[0.04]">
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="px-4 py-2 bg-white/5 text-slate-300 rounded-[4px] hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
