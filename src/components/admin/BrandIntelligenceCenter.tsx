import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  BarChart3, 
  Lock, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Star, 
  ThumbsUp, 
  TrendingUp, 
  History, 
  MessageCircle, 
  Search, 
  Sliders, 
  ChevronRight,
  AlertTriangle,
  Info,
  Package,
  Tag,
  Plus,
  RefreshCw,
  Ban,
  ListOrdered,
  Globe,
  ArrowRight,
  FileText,
  Clock,
  Sparkles,
  X,
  Sparkle,
  CornerDownRight,
  ShieldCheck,
  Calendar,
  Layers,
  Award,
  Mail,
  Phone,
  MapPin,
  Truck,
  Activity,
  Trash,
  ArrowUpRight,
  FileSpreadsheet,
  Receipt
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { 
  BrandProfile, 
  BrandStatus, 
  OwnershipClaim, 
  BrandAuditLog 
} from '../../contexts/BrandProfilesContext';

interface BrandIntelligenceCenterProps {
  brandId: string;
  brandName: string;
  onClose: () => void;
  profiles: BrandProfile[];
  claims: OwnershipClaim[];
  logs: BrandAuditLog[];
  updateProfile: (id: string, data: Partial<BrandProfile>) => void;
  reviewClaim: (claimId: string, status: 'Approved' | 'Rejected' | 'Under Investigation', reviewer: string, reason: string, notes?: string) => void;
  addLog: (brandName: string, action: string, reason: string, adminUser: string) => void;
  outerProducts: any[];
  setOuterProducts: React.Dispatch<React.SetStateAction<any[]>>;
  outerDeals: any[];
  setOuterDeals: React.Dispatch<React.SetStateAction<any[]>>;
  showToast: (msg: string) => void;
}

// Procedural generator to provide beautiful, high-fidelity data tailored to any brand name
function getBrandBlueprint(brandName: string, isProfileBased: boolean) {
  // Let's create a stable hash code based on the brand's name
  let hash = 0;
  for (let i = 0; i < brandName.length; i++) {
    hash = brandName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const absHash = Math.abs(hash);

  const categories = ['Electronics & Gadgets', 'Fashion & Apparel', 'Home & Furniture', 'Food & FMCG', 'Consumer Goods'];
  const category = categories[absHash % categories.length];

  const trustScore = 75 + (absHash % 25); // 75-99
  const riskStatus = trustScore > 90 ? 'Low Risk' : trustScore > 80 ? 'Medium Risk' : 'High Risk';
  const settlementStrategies = ['Standard Net-3 Cycle', 'Standard Net-7 Escrow', 'Express 24H Liquidation', '15-Day Corporate Ledger'];
  const settlementStrategy = settlementStrategies[absHash % settlementStrategies.length];
  
  const licenseNum = `TR-LIC-${200000 + (absHash % 800000)}BD`;
  const vatNum = `VAT-${10000000 + (absHash % 90000000)}-BD`;
  const tinNum = `TIN-${500000000 + (absHash % 500000000)}`;

  const representative = isProfileBased ? 'Choosify Lead Acquisition Team' : `Engr. ${brandName.substring(0, 3)} Administrator`;
  const email = `${brandName.toLowerCase().replace(/\s+/g, '')}.corp@choosify-partner.com`;
  const phone = `+880 171${100000 + (absHash % 900000)}`;

  const address = `House ${12 + (absHash % 80)}, Road ${3 + (absHash % 15)}, Sector ${1 + (absHash % 14)}, Uttara, Dhaka`;
  const warehouseAddress = `Plot ${45 + (absHash % 100)}, Tejgaon Industrial Area, Phase II, Dhaka`;

  // SLA
  const fulfillmentRate = `${95 + (absHash % 5)}.${absHash % 10}%`;
  const returnRate = `0.${1 + (absHash % 9)}%`;
  const cancellationRate = `0.${absHash % 5}%`;
  const complaintRatio = `0.0${1 + (absHash % 4)}%`;

  const bestSeller = `${brandName} Elite Edition Pro`;
  const monthlyRevenue = 40000 + (absHash % 180000);

  return {
    category,
    trustScore,
    riskStatus,
    settlementStrategy,
    licenseNum,
    vatNum,
    tinNum,
    representative,
    email,
    phone,
    address,
    warehouseAddress,
    fulfillmentRate,
    returnRate,
    cancellationRate,
    complaintRatio,
    bestSeller,
    monthlyRevenue
  };
}

export const BrandIntelligenceCenter: React.FC<BrandIntelligenceCenterProps> = ({
  brandId,
  brandName,
  onClose,
  profiles,
  claims,
  logs,
  updateProfile,
  reviewClaim,
  addLog,
  outerProducts,
  setOuterProducts,
  outerDeals,
  setOuterDeals,
  showToast
}) => {
  // Try to find the local profile or claim references
  const matchedProfile = useMemo(() => {
    return profiles.find(p => p.id === brandId || p.name.toLowerCase() === brandName.toLowerCase());
  }, [profiles, brandId, brandName]);

  const matchedClaimsList = useMemo(() => {
    return claims.filter(c => c.brandId === brandId || c.brandName.toLowerCase() === brandName.toLowerCase());
  }, [claims, brandId, brandName]);

  const activeClaim = useMemo(() => {
    return matchedClaimsList.find(c => c.verificationStatus === 'Pending Review') || matchedClaimsList[0];
  }, [matchedClaimsList]);

  const isProfileBased = !!matchedProfile;
  const currentStatus: BrandStatus = matchedProfile ? (matchedProfile.status as BrandStatus) : 'VERIFIED_OWNER';

  // Procedural computations matching 13 specifications
  const bp = useMemo(() => {
    return getBrandBlueprint(brandName, isProfileBased);
  }, [brandName, isProfileBased]);

  // Tab selections
  type SubTabType = 'overview' | 'identity' | 'contact' | 'commerce' | 'products' | 'orders' | 'trust';
  const [currentTab, setCurrentTab] = useState<SubTabType>('overview');

  // Input states for Interactive Actions
  const [outreachMsg, setOutreachMsg] = useState('');
  const [chatTimeline, setChatTimeline] = useState<Array<{id: string, date: string, type: string, message: string}>>([
    { id: '1', date: '2026-06-15 11:20', type: 'System', message: 'Corporate brand intelligence profile synthesized successfully.' },
    { id: '2', date: '2026-06-16 09:40', type: 'Admin Desk', message: 'Verified active status matching trade registries.' }
  ]);

  // New simulated product creation state inside the drawer
  const [productUploadForm, setProductUploadForm] = useState({ name: '', price: '', category: bp.category });
  
  // Pending review check
  const [verificationNotes, setVerificationNotes] = useState('');
  const [reviewReasonInput, setReviewReasonInput] = useState('');

  // Local state for warnings count
  const [incidentsCount, setIncidentsCount] = useState(matchedClaimsList.some(c => c.verificationStatus === 'Rejected') ? 1 : 0);

  // Mapped list of products belonging to this seller/brand
  const brandProducts = useMemo(() => {
    return outerProducts.filter(p => p.seller.toLowerCase() === brandName.toLowerCase());
  }, [outerProducts, brandName]);

  // Simulated orders
  const [simulatedOrders, setSimulatedOrders] = useState<Array<{
    id: string;
    customer: string;
    date: string;
    amount: string;
    status: 'Delivered' | 'Pending Transit' | 'Refund Pending' | 'Processing';
    items: string;
  }>>([
    { id: 'ORD-958431', customer: 'Imran Khan', date: '2026-06-17', amount: '৳ 3,450', status: 'Processing', items: `${brandName} Standard Pack x1` },
    { id: 'ORD-548219', customer: 'Ayesha Rahman', date: '2026-06-16', amount: '৳ 12,000', status: 'Delivered', items: `${brandName} Premium Pro x2` },
    { id: 'ORD-128495', customer: 'Adnan Chowdhury', date: '2026-06-14', amount: '৳ 1,890', status: 'Delivered', items: `${brandName} Essential Accessory x1` }
  ]);

  // Handle outreach logger
  const handleAddOutreach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outreachMsg.trim()) return;
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setChatTimeline(prev => [
      ...prev,
      { id: Date.now().toString(), date: dateStr, type: 'Correspondence Outreach', message: outreachMsg }
    ]);
    addLog(
      brandName,
      `Correspondence note uploaded`,
      `Communication Log: "${outreachMsg}"`,
      'Operations Administrator Office'
    );
    setOutreachMsg('');
    showToast('✓ Communication log saved securely to timeline.');
  };

  // Handle claim approval inside drawer
  const triggerClaimApproval = (claimId: string) => {
    reviewClaim(
      claimId,
      'Approved',
      'Lead Operations Administrator',
      reviewReasonInput || 'Verified matching physical certificate archives and corporate TAX domains.'
    );
    addLog(
      brandName,
      'Corporate Ownership Claim Approved',
      reviewReasonInput || 'Brand ownership verified fully. Authorized access provisioned to represent merchant account.',
      'Operations Administrator Office'
    );
    showToast('✓ Brand claimed successfully! Profile status upgraded to VERIFIED_OWNER.');
    setReviewReasonInput('');
  };

  // Handle claim rejection inside drawer
  const triggerClaimRejection = (claimId: string) => {
    reviewClaim(
      claimId,
      'Rejected',
      'Lead Operations Administrator',
      reviewReasonInput || 'Failed document authenticity test. No association established with trade records.'
    );
    addLog(
      brandName,
      'Corporate Ownership Claim REJECTED',
      reviewReasonInput || 'Claim rejected. Documentation metadata is insufficient or corrupted.',
      'Compliance & Audit Officer'
    );
    setIncidentsCount(c => c + 1);
    showToast('❌ Claim rejected. Status reset to Unclaimed. Compliance alert issued.');
    setReviewReasonInput('');
  };

  // Directly adjust profile state (e.g. suspend / ban / verify)
  const adjustBrandStatus = (newStat: BrandStatus, reasonMsg: string) => {
    if (!matchedProfile) {
      showToast('⚠️ Manual status override is currently restricted to pre-boarding profile entities.');
      return;
    }
    updateProfile(matchedProfile.id, { status: newStat });
    addLog(
      brandName,
      `State altered manually to ${newStat}`,
      reasonMsg,
      'Corporate Governance Desk'
    );
    showToast(`✓ Core profile status altered to: ${newStat}`);
  };

  // Inline product publishing
  const publishProductInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productUploadForm.name || !productUploadForm.price) return;
    
    // Add to actual list
    const nwProd = {
      id: `p_dr_${Date.now().toString().substring(7)}`,
      name: productUploadForm.name,
      category: productUploadForm.category,
      seller: brandName,
      price: productUploadForm.price.startsWith('৳') ? productUploadForm.price : `৳ ${productUploadForm.price}`,
      status: currentStatus === 'UNCLAIMED' ? 'Pending' : 'Live'
    };

    setOuterProducts(prev => [nwProd, ...prev]);
    showToast(`✓ Product "${nwProd.name}" published for ${brandName}. Status: ${nwProd.status}`);
    setProductUploadForm({ name: '', price: '', category: bp.category });
  };

  // Simulated chart data
  const commerceData = [
    { name: 'Jun', Sales: bp.monthlyRevenue * 0.8, Visitors: 14000, Conversion: 3.1 },
    { name: 'Jul', Sales: bp.monthlyRevenue * 0.95, Visitors: 15200, Conversion: 3.3 },
    { name: 'Aug', Sales: bp.monthlyRevenue * 0.75, Visitors: 12900, Conversion: 2.8 },
    { name: 'Sep', Sales: bp.monthlyRevenue * 1.1, Visitors: 18400, Conversion: 3.5 },
    { name: 'Oct', Sales: bp.monthlyRevenue * 1.3, Visitors: 21100, Conversion: 3.9 },
    { name: 'Nov', Sales: bp.monthlyRevenue * 1.25, Visitors: 19800, Conversion: 3.7 },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col font-sans text-white animate-in slide-in-from-right duration-300">
      
      {/* 1. STICKY ACTION HEADER & STATUS BAR */}
      <div className="bg-slate-900 border-b border-white/10 p-5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-950 border border-white/20 rounded-xl flex items-center justify-center overflow-hidden">
            {matchedProfile?.logo ? (
              <img src={matchedProfile.logo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6 text-[#F4631E]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">{brandName}</h2>
              <span className={`px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase font-mono ${
                currentStatus === 'VERIFIED_OWNER' 
                  ? 'bg-green-500/10 text-emerald-400 border border-green-500/20' 
                  : currentStatus === 'OWNERSHIP_PENDING' 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse' 
                  : currentStatus === 'SUSPENDED'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-white/5 text-slate-400 border border-white/5'
              }`}>
                {currentStatus.replace('_', ' ')}
              </span>
              
              <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-black tracking-wider font-mono">
                {currentStatus === 'UNCLAIMED' ? 'TIER 3 STANDBY' : 'TIER 1 PARTNER'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold">{matchedProfile?.companyName || `Unregistered Brand Identity Entity`}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Quick Override Actions for Admins */}
          {matchedProfile && (
            <div className="hidden md:flex gap-1.5 mr-2">
              {currentStatus !== 'SUSPENDED' ? (
                <button 
                  onClick={() => adjustBrandStatus('SUSPENDED', 'Administrative compliance suspension.')}
                  className="px-2.5 py-1 text-[10px] uppercase font-black bg-white/5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded transition-all cursor-pointer"
                >
                  Suspend Group
                </button>
              ) : (
                <button 
                  onClick={() => adjustBrandStatus('VERIFIED_OWNER', 'Administrative status restoration.')}
                  className="px-2.5 py-1 text-[10px] uppercase font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-all cursor-pointer"
                >
                  Restore Active
                </button>
              )}
              {currentStatus === 'UNCLAIMED' && (
                <button 
                  onClick={() => adjustBrandStatus('OWNERSHIP_PENDING', 'Simulated on-behalf application submitted.')}
                  className="px-2.5 py-1 text-[10px] uppercase font-black bg-orange-500/10 border border-orange-500/20 text-[#F4631E] rounded hover:bg-[#F4631E] hover:text-white transition-all cursor-pointer"
                >
                  Push Claim Request
                </button>
              )}
            </div>
          )}

          <button 
            onClick={onClose} 
            className="flex items-center gap-1 p-2 bg-white/5 hover:bg-white/10 hover:text-[#F4631E] border border-white/5 rounded-xl text-xs font-black transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>CLOSE</span>
          </button>
        </div>
      </div>

      {/* 2. DOCK NAVIGATION HEADER (13 specification categories) */}
      <div className="bg-slate-900/45 border-b border-white/10 px-6 py-1 flex overflow-x-auto scrollbar-hide gap-1 bg-black/40 shrink-0">
        {[
          { id: 'overview', label: '📊 Corporate Profile & Health', icon: Info },
          { id: 'identity', label: '✔️ ID Registries & Verification', icon: ShieldCheck },
          { id: 'contact', label: '📞 Contact & Logistics Hubs', icon: MapPin },
          { id: 'commerce', label: '📈 Commercial Velocity', icon: BarChart3 },
          { id: 'products', label: '📦 Products Desk', icon: Package },
          { id: 'orders', label: '🧾 Orders Console', icon: ListOrdered },
          { id: 'trust', label: '🛡️ Trust Ledger & Compliance', icon: ShieldAlert }
        ].map(sh => {
          const Icon = sh.icon || Info;
          const isActive = currentTab === sh.id;
          return (
            <button
              key={sh.id}
              onClick={() => setCurrentTab(sh.id as SubTabType)}
              className={`py-3.5 px-4 text-[10.5px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all border-b-2 hover:text-white ${
                isActive 
                  ? 'border-[#F4631E] text-[#F4631E] bg-white/[0.01]' 
                  : 'border-transparent text-slate-400 hover:border-white/10'
              } cursor-pointer`}
            >
              <Icon className="w-3.5 h-3.5" />
              {sh.label}
            </button>
          );
        })}
      </div>

      {/* 3. CORE SCROLL CONSOLE */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950 space-y-6">

        {/* ========================================= OVERVIEW TAB ========================================= */}
        {currentTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Executive Health Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Trust gauge */}
              <div className="bg-slate-900 border border-white/5 p-4.5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Executive Trust Score</span>
                  <Award className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="py-4 flex items-center gap-4">
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center font-black text-white text-lg bg-emerald-500/10 border-2 border-emerald-500/20 rounded-full font-mono">
                    {currentStatus === 'UNCLAIMED' ? 'N/A' : `${bp.trustScore}%`}
                  </div>
                  <div>
                    <span className={`text-[11px] font-bold block uppercase ${currentStatus === 'UNCLAIMED' ? 'text-slate-400' : 'text-emerald-400'}`}>
                      {currentStatus === 'UNCLAIMED' ? 'No Registered Merchant' : bp.riskStatus}
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-normal mt-0.5">
                      {currentStatus === 'UNCLAIMED' ? 'Pre-onboarding status without history.' : 'SLA metric aggregates reflect superb rating.'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full" style={{ width: currentStatus === 'UNCLAIMED' ? '0%' : `${bp.trustScore}%` }} />
                </div>
              </div>

              {/* Settlement Strategy */}
              <div className="bg-slate-900 border border-white/5 p-4.5 rounded-2xl flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Settlement Strategy</span>
                  <Receipt className="w-4 h-4 text-blue-400" />
                </div>
                <div className="py-2.5">
                  <span className="text-md font-extrabold text-white font-mono block tracking-tight">
                    {currentStatus === 'UNCLAIMED' ? 'Pre-Merchant Escrow' : bp.settlementStrategy}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Automatic financial clearance tier.</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 border-t border-white/5 pt-2 font-semibold">
                  <span>SLA Period: 24h-3D</span>
                  <span className="text-emerald-400">Approved Gateway</span>
                </div>
              </div>

              {/* Compliance & Grade */}
              <div className="bg-slate-900 border border-white/5 p-4.5 rounded-2xl flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Compliance & Grade</span>
                  <ShieldCheck className="w-4 h-4 text-[#F4631E]" />
                </div>
                <div className="py-2.5">
                  <span className="text-md font-extrabold text-white block tracking-tight">
                    {currentStatus === 'SUSPENDED' ? '🔒 SUSPENDED' : 'Grade A+ Fully Compliant'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Regular warehouse audits passed successfully.</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 border-t border-white/5 pt-2 font-semibold font-mono">
                  <span>Incident Rate: {incidentsCount}</span>
                  <span className="text-yellow-400">Regular Monitor</span>
                </div>
              </div>
            </div>

            {/* Biography & Key attributes */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Business Registry Biography</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {matchedProfile?.description || `${brandName} is a premium market leader curated on-demand. This intelligence system allows monitoring corporate footprint parameters, licensing verification states, and pre- merchant search metadata.`}
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">Entity Owner</span>
                  <span className="font-bold text-white block">{matchedProfile?.ownerSellerId ? `Merchant Account Associated` : 'Pre-boarding Agent Managed'}</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">Primary Market Group</span>
                  <span className="font-bold text-white block">{bp.category}</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">Corporate Registry Country</span>
                  <span className="font-bold text-white block">{matchedProfile?.country || 'Bangladesh'}</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase mb-1">System Audit Level</span>
                  <span className="font-bold text-emerald-400 block font-mono">L3 Enterprise Certified</span>
                </div>
              </div>
            </div>

            {/* Profile SLA Matrix */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Operational SLA Delivery Health Tracker</span>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-black/30 p-3.5 rounded-xl">
                  <span className="text-lg font-black text-white font-mono block">{bp.fulfillmentRate}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Fulfillment Rate</span>
                </div>
                <div className="bg-black/30 p-3.5 rounded-xl">
                  <span className="text-lg font-black text-emerald-400 font-mono block">{bp.returnRate}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Customer Returns</span>
                </div>
                <div className="bg-black/30 p-3.5 rounded-xl">
                  <span className="text-lg font-black text-emerald-400 font-mono block">{bp.cancellationRate}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Merchant Cancellations</span>
                </div>
                <div className="bg-black/30 p-3.5 rounded-xl">
                  <span className="text-lg font-black text-white font-mono block">{bp.complaintRatio}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Complaint Rate</span>
                </div>
              </div>
            </div>

            {/* Brand Portfolio mapping */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Portfolio and Corporate Hierarchy</span>
                <span className="text-[9px] bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E] px-2.5 py-0.5 rounded font-black font-mono">Auto Associated</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="p-3 bg-black/40 rounded-xl space-y-1">
                  <span className="text-[9px] text-[#F4631E] uppercase font-bold block">Parent Holding</span>
                  <span className="font-extrabold text-white block">{brandName} Group Holdings Ltd.</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl space-y-1">
                  <span className="text-[9px] text-emerald-400 uppercase font-bold block">Sub-brand catalog</span>
                  <span className="font-extrabold text-white block">{brandName} Casuals, {brandName} Essential Group</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Storefront URL mapping</span>
                  <span className="font-extrabold text-white block font-mono">/brand/{brandName.toLowerCase().replace(/\s+/g, '-')}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================= IDENTITY & VERIFICATION TAB ========================================= */}
        {currentTab === 'identity' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Government identity entries */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">National Licensing & Corporate Identity registers</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-white/10 relative">
                  <FileText className="w-4 h-4 text-orange-500 absolute top-4 right-4" />
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Trade License</span>
                  <span className="text-sm font-extrabold text-white block mt-1 font-mono">{bp.licenseNum}</span>
                  <span className="text-[10px] text-emerald-400 mt-2 block font-semibold">✓ Active & Match Certified</span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-white/10 relative">
                  <FileText className="w-4 h-4 text-emerald-500 absolute top-4 right-4" />
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">VAT Registration</span>
                  <span className="text-sm font-extrabold text-white block mt-1 font-mono">{bp.vatNum}</span>
                  <span className="text-[10px] text-emerald-400 mt-2 block font-semibold">✓ verified fully (NBR Gate)</span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-white/10 relative">
                  <FileText className="w-4 h-4 text-blue-500 absolute top-4 right-4" />
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block">Corporate Tax ID (TIN)</span>
                  <span className="text-sm font-extrabold text-white block mt-1 font-mono">{bp.tinNum}</span>
                  <span className="text-[10px] text-emerald-400 mt-2 block font-semibold">✓ Active & Income Cleared</span>
                </div>
              </div>
            </div>

            {/* Claims & Verification Hub */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Ownership claim workflow desk</span>

              {/* Status block checker */}
              {currentStatus === 'UNCLAIMED' && (
                <div className="p-5 bg-orange-500/5 border border-orange-500/15 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-400 animate-pulse" />
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">Unclaimed pre-merchant acquisition funnel</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">
                    This brand directory record is currently unclaimed. You can associate an active seller registration request, verify corporate trademark credentials, or submit an official claim representing a real merchant.
                  </p>

                  <div className="pt-2 flex justify-start">
                    <button 
                      onClick={() => adjustBrandStatus('OWNERSHIP_PENDING', 'Acquisition request initiated from operational headquarters.')}
                      className="px-4 py-2 bg-[#F4631E] hover:bg-[#F4631E]/95 text-white text-[11px] font-black uppercase rounded-lg tracking-wide shadow transition-all cursor-pointer"
                    >
                      Promote to Pending Ownership Audit
                    </button>
                  </div>
                </div>
              )}

              {currentStatus === 'OWNERSHIP_PENDING' && (
                <div className="p-5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />
                      <h4 className="text-xs font-black uppercase text-white tracking-wider">Ownership Verification SLA Under Way</h4>
                    </div>
                    <span className="text-[8.5px] bg-yellow-500/10 text-yellow-500 font-extrabold font-mono border border-yellow-500/20 px-2.5 py-0.5 rounded uppercase">Pending Review Desk</span>
                  </div>

                  {activeClaim ? (
                    <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-xs grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black block">Claim Applicant</span>
                        <strong className="text-white block mt-0.5">{activeClaim.applicantName}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-black block">Applicant Corporate Email</span>
                        <strong className="text-white block mt-0.5 font-mono">{activeClaim.businessEmail}</strong>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-white/5">
                        <span className="text-[9px] text-slate-500 uppercase font-black block">Uploaded Claim Certificate ID</span>
                        <strong className="text-white block mt-0.5 font-mono text-[10px] text-amber-500">{activeClaim.tradeLicense} (Matched Certificate)</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Simulating applicant credentials for pre-merchant request analysis.</p>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 font-black uppercase">Oversight reason input (Required to execute choice)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Approved. Corporate tax registries match fully, registry DNS txt token identified."
                      value={reviewReasonInput}
                      onChange={(e) => setReviewReasonInput(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => activeClaim ? triggerClaimApproval(activeClaim.id) : adjustBrandStatus('VERIFIED_OWNER', 'Corporate claim manual approval.')}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase rounded-lg tracking-wider cursor-pointer"
                    >
                      Approve Ownership Claim
                    </button>
                    <button 
                      onClick={() => activeClaim ? triggerClaimRejection(activeClaim.id) : adjustBrandStatus('UNCLAIMED', 'Corporate claim manual rejection.')}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase rounded-lg tracking-wider cursor-pointer"
                    >
                      Reject Claim
                    </button>
                  </div>
                </div>
              )}

              {currentStatus === 'VERIFIED_OWNER' && (
                <div className="p-5 bg-green-500/5 border border-green-500/15 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <h4 className="text-xs font-black uppercase text-white tracking-wider">Corporate entity ownership verified</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">
                    This profile represents an authorized corporate merchant fully verified against national Trademark registry databases. All future catalog listings bypass generic moderation delays.
                  </p>

                  <div className="pt-2 flex gap-3 text-xs">
                    <button 
                      onClick={() => adjustBrandStatus('SUSPENDED', 'Regulatory suspension triggered manually.')}
                      className="px-3 py-1.5 bg-black/40 hover:bg-red-500/15 text-red-500 border border-white/10 hover:border-red-500/20 rounded font-bold uppercase transition"
                    >
                      Revoke Claim & Suspend
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================= CONTACT & LOGISTICS TAB ========================================= */}
        {currentTab === 'contact' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Official Contact Panel */}
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Official Contacts Register</span>
                
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                    <Mail className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Primary Business Email</span>
                      <strong className="text-white block mt-0.5 font-mono">{matchedProfile?.websiteUrl ? `${matchedProfile.name.toLowerCase().replace(/\s+/g, '')}@corp-domain.com` : bp.email}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Representative Tel line</span>
                      <strong className="text-white block mt-0.5 font-mono">{bp.phone}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Corporate website domain</span>
                      <a href={matchedProfile?.websiteUrl || '#'} target="_blank" rel="noreferrer" className="text-[#F4631E] hover:underline block mt-0.5 font-mono">
                        {matchedProfile?.websiteUrl || `https://www.${brandName.toLowerCase().replace(/\s+/g, '')}-brands.com`}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logistics and Distribution hubs */}
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Warehouses & Logistics Mapping</span>
                
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                    <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Registered Corporate HQ Address</span>
                      <p className="text-white mt-1 leading-normal">{bp.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                    <Truck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold block uppercase">Operational Warehouse Location</span>
                      <p className="text-white mt-1 leading-normal">{bp.warehouseAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-between bg-black/40 p-2 px-3 rounded-lg border border-white/5 text-[10.5px]">
                    <span className="text-slate-400">Integrated Fulfilled Partner:</span>
                    <strong className="text-emerald-400 font-bold uppercase">Choosify Express Prime</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Outreach Communication Log Thread */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Administrative Outreach Notes</span>
              
              <div className="space-y-3">
                {chatTimeline.map(ch => (
                  <div key={ch.id} className="p-3 bg-slate-950 border border-white/5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center border-b border-white/5 pb-1 mb-1">
                      <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase font-mono">{ch.type}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{ch.date}</span>
                    </div>
                    <p className="text-slate-300 leading-normal">{ch.message}</p>
                  </div>
                ))}
              </div>

              {/* Form to submit correspondence outreach notice */}
              <form onSubmit={handleAddOutreach} className="flex gap-3">
                <input 
                  type="text" 
                  value={outreachMsg}
                  onChange={(e) => setOutreachMsg(e.target.value)}
                  placeholder="Record note in permanent audit log (e.g. Spoke to Director. Approved trade certificates)..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-orange-500"
                />
                <button 
                  type="submit"
                  className="px-5 py-3 bg-[#F4631E] hover:bg-[#F4631E]/90 text-white font-black text-[11px] uppercase rounded-xl tracking-wide cursor-pointer text-center whitespace-nowrap"
                >
                  Post Note
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ========================================= COMMERCE MATRIX TAB ========================================= */}
        {currentTab === 'commerce' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Commerce top panel */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9.5px]">Est. Monthly GMV</span>
                <span className="text-xl font-black text-emerald-400 font-mono">৳ {(bp.monthlyRevenue * 1.25).toLocaleString([], {maximumFractionDigits:0})}</span>
                <span className="text-[#F4631E] flex items-center gap-1 font-bold text-[10px] mt-1">
                  <TrendingUp className="w-3 h-3" />
                  +12.4% velocity
                </span>
              </div>

              <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9.5px]">Average Basket Size</span>
                <span className="text-xl font-black text-white font-mono">৳ 3,450</span>
                <span className="text-slate-400 font-semibold block text-[10px] sm:mt-1">Based on category averages</span>
              </div>

              <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9.5px]">Traffic Unique Reach</span>
                <span className="text-xl font-black text-white font-mono">34,190 / mo</span>
                <span className="text-emerald-400 font-bold block text-[10px] mt-1">High SEO Index Priority</span>
              </div>

              <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[9.5px]">Catalog Conversion Ratio</span>
                <span className="text-xl font-black text-white font-mono">3.4%</span>
                <span className="text-slate-400 block text-[10px] mt-1">Stable pipeline checkout SLA</span>
              </div>
            </div>

            {/* Area Chart visualization using Recharts */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Commercial Velocity Projection (6-Months Ledger)</span>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={commerceData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F4631E" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#F4631E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `৳${val/1000}k`} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', borderRadius: '12px' }}
                      formatter={(value) => [`৳${Number(value).toLocaleString()}`, 'Simulated Sales Volume']} 
                    />
                    <Area type="monotone" dataKey="Sales" stroke="#F4631E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* ========================================= PRODUCTS TAB ========================================= */}
        {currentTab === 'products' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Inline Product Creator form */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2 mb-4">Quick Publish Item (Direct Listing)</span>
              
              <form onSubmit={publishProductInline} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Product Display Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Apex Extreme Comfort Loafers"
                    value={productUploadForm.name}
                    onChange={(e) => setProductUploadForm({ ...productUploadForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Unit Price (BDT)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 4,500"
                    value={productUploadForm.price}
                    onChange={(e) => setProductUploadForm({ ...productUploadForm, price: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                  />
                </div>

                <button 
                  type="submit"
                  className="py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-[11px] rounded-lg tracking-widest uppercase cursor-pointer"
                >
                  Publish instantly
                </button>
              </form>
            </div>

            {/* Products Table list specifically filtered for this brand */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2.5 mb-3">Brand Catalog Listing Desk</span>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 font-bold uppercase text-[9px] tracking-wide">
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Product Name</th>
                      <th className="py-2.5">Category Area</th>
                      <th className="py-2.5">In-Stock Check</th>
                      <th className="py-2.5">List Price</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Oversight Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {brandProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 italic">No custom products uploaded for this brand catalog yet. Use the quick form above to list items.</td>
                      </tr>
                    ) : (
                      brandProducts.map(p => (
                        <tr key={p.id} className="hover:bg-white/[0.01]">
                          <td className="py-3 font-mono text-[10px] text-slate-400">{p.id}</td>
                          <td className="py-3 font-bold text-white">{p.name}</td>
                          <td className="py-3 text-[11px] text-slate-300">{p.category}</td>
                          <td className="py-3 text-[11px] text-emerald-400 font-mono">100% SLA Green</td>
                          <td className="py-3 font-mono font-bold text-slate-200">{p.price}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              p.status === 'Live' ? 'bg-green-500/10 border border-green-500/25 text-green-400' :
                              p.status === 'Pending' ? 'bg-orange-500/10 border border-orange-500/25 text-orange-400 animate-pulse' :
                              'bg-red-500/10 border border-red-500/25 text-red-500'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex gap-1.5 justify-end">
                              {p.status === 'Pending' && (
                                <button 
                                  onClick={() => {
                                    setOuterProducts(prev => prev.map(item => item.id === p.id ? { ...item, status: 'Live' } : item));
                                    showToast(`✓ Active moderation bypassed fully. "${p.name}" is now live!`);
                                  }}
                                  className="px-2 py-0.5 bg-green-500 text-white font-bold text-[10px] rounded hover:scale-102 cursor-pointer uppercase"
                                >
                                  Approve Live
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  setOuterProducts(prev => prev.filter(item => item.id !== p.id));
                                  showToast(`✓ Listing deleted: "${p.name}"`);
                                }}
                                className="px-2 py-0.5 bg-white/5 border border-white/5 text-slate-400 hover:text-red-500 rounded text-[10px] cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================= ORDERS CONSOLE TAB ========================================= */}
        {currentTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Corporate Orders & Shipment dispatch ledger</span>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs pb-4">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 font-bold uppercase text-[9px] tracking-wide">
                      <th className="py-2.5">Order ID</th>
                      <th className="py-2.5">Purchaser</th>
                      <th className="py-2.5">Items / Configuration</th>
                      <th className="py-2.5">Cleared Date</th>
                      <th className="py-2.5 font-mono">Invoice clearance</th>
                      <th className="py-2.5">Delivery Status</th>
                      <th className="py-2.5 text-right">Quick actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {simulatedOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-mono text-[10px] font-bold text-[#F4631E]">{ord.id}</td>
                        <td className="py-3 font-medium text-slate-200">{ord.customer}</td>
                        <td className="py-3 text-slate-300 font-bold truncate max-w-[180px]">{ord.items}</td>
                        <td className="py-3 font-mono text-slate-400">{ord.date}</td>
                        <td className="py-3 font-mono text-emerald-400 font-bold">{ord.amount}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                            ord.status === 'Delivered' ? 'bg-green-500/10 text-emerald-400 border border-green-500/20' :
                            ord.status === 'Processing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            {ord.status === 'Processing' && (
                              <button 
                                onClick={() => {
                                  setSimulatedOrders(prev => prev.map(o => o.id === ord.id ? { ...o, status: 'Delivered' } : o));
                                  showToast('✓ Shipment status marked as "Delivered" successfully.');
                                }}
                                className="px-2 py-0.5 bg-green-500 text-white font-bold text-[9px] uppercase tracking-wider rounded cursor-pointer"
                              >
                                Delivered
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setSimulatedOrders(prev => prev.map(o => o.id === ord.id ? { ...o, status: 'Refund Pending' } : o));
                                showToast('⚠️ Refund dispute requested dynamically.');
                              }}
                              className="px-2 py-0.5 bg-white/5 border border-white/5 hover:text-red-400 rounded text-[9.5px] cursor-pointer"
                            >
                              Refund
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================= TRUST LEDGER & TIMELINE TAB ========================================= */}
        {currentTab === 'trust' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Direct Penalize Actions */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2">Manual administration escalation actions</span>
              <p className="text-xs text-slate-400">
                Execute corporate warnings, place catalogs under strict escrows, or trigger full account suspensions due to intellectual property violations or duplicate listings detections.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <button 
                  onClick={() => {
                    setIncidentsCount(c => c + 1);
                    addLog(brandName, 'Compliance Warning issued', 'Sent administrative warning regarding suspicious catalog duplicates claims.', 'Security Operations');
                    showToast('✓ Formal SLA compliance warning dispatched to brand rep.');
                  }}
                  className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/20 rounded font-black text-[10.5px] uppercase cursor-pointer"
                >
                  ⚠️ File Compliance Warning
                </button>
                
                <button 
                  onClick={() => adjustBrandStatus('SUSPENDED', 'Pre-emptive compliance block issued by chief executive officer.')}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-500 border border-red-500/20 rounded font-black text-[10.5px] uppercase cursor-pointer"
                >
                  🔒 Deactivate Corporate Store
                </button>

                <button 
                  onClick={() => {
                    addLog(brandName, 'Clean integrity score approved', 'Passed complete intellectual audit without infractions.', 'Compliances Officer');
                    setIncidentsCount(0);
                    showToast('✓ Compliance infractions scorecard cleared successfully!');
                  }}
                  className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/25 text-emerald-400 border border-emerald-500/20 rounded font-black text-[10.5px] uppercase cursor-pointer"
                >
                  ✔️ Clear Scorecard Infractions
                </button>
              </div>
            </div>

            {/* Audit log trail specific to this brand */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block border-b border-white/5 pb-2_ timeline">Immutable Brand Intelligence Security Timeline</span>
              
              <div className="space-y-4.5 pl-3.5 relative border-l border-white/10 ml-1 pb-2">
                {logs.filter(lg => lg.brandName.toLowerCase() === brandName.toLowerCase()).length === 0 ? (
                  <div className="text-xs text-slate-500 italic pt-1">
                    No timeline actions recorded.
                  </div>
                ) : (
                  logs.filter(lg => lg.brandName.toLowerCase() === brandName.toLowerCase()).map(lg => (
                    <div key={lg.id} className="relative space-y-1">
                      {/* circle */}
                      <span className="w-2.5 h-2.5 bg-[#F4631E] rounded-full border border-slate-950 absolute -left-[20px] top-[4px]" />
                      <div className="flex justify-between items-baseline text-xs">
                        <strong className="text-white text-[11px] tracking-tight">{lg.action}</strong>
                        <span className="text-[9.5px] text-slate-500 font-mono">{new Date(lg.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-400 leading-normal">{lg.reason}</p>
                      <span className="text-[9.5px] text-slate-600 block font-mono">Operations: {lg.adminUser}</span>
                    </div>
                  ))
                )}
                
                {/* Standard base item */}
                <div className="relative space-y-1">
                  <span className="w-2.5 h-2.5 bg-slate-500 rounded-full border border-slate-950 absolute -left-[20px] top-[4px]" />
                  <div className="flex justify-between items-baseline text-xs">
                    <strong className="text-slate-400 text-[11px]">System Bootstrap Profile</strong>
                    <span className="text-[9.5px] text-slate-500 font-mono">2026-06-15 00:00</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-normal">Initial registry metadata created via onboarding system database.</p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
