import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  ArrowLeft, 
  Package, 
  Star, 
  TrendingUp, 
  Users, 
  Calendar, 
  Globe, 
  Eye, 
  MousePointer2, 
  BarChart3,
  ExternalLink,
  Ban,
  CheckCircle2,
  ChevronRight,
  User,
  ShieldAlert,
  Info,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Upload,
  Mail,
  Phone,
  MapPin,
  Lock,
  Tag,
  DollarSign,
  Share2,
  Award,
  Bell,
  RefreshCw,
  Sliders,
  Check,
  Search,
  Plus
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useBrandProfiles } from '../../contexts/BrandProfilesContext';

// Standard Brand Management Studio tabs
type TabId = 'account' | 'verification' | 'portfolio' | 'products' | 'orders' | 'reviews' | 'marketing';

export default function BrandDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profiles, updateProfile, reviewClaim, logs, addLog } = useBrandProfiles();

  // Find profile in standard database or generate a standard fallback
  const brandProfile = useMemo(() => {
    const found = profiles.find(p => p.id === id);
    if (found) return found;

    // Fallback brand metadata if ID isn't directly matching a seed profile
    const name = id ? id.replace('brand_seller_', '').replace('brand_', '').replace(/_/g, ' ') : 'Premium Brand Partner';
    const cleanName = name.charAt(0).toUpperCase() + name.slice(1);
    
    return {
      id: id || 'brand_fallback',
      slug: id || 'fallback',
      name: cleanName,
      logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&q=80',
      coverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
      description: 'Global standard seller on Choosify, delivering top-quality goods with fast merchant fulfillment.',
      industry: 'Consumer Goods',
      category: 'Electronics & Mobiles',
      country: 'Bangladesh',
      websiteUrl: 'https://choosify.com.bd',
      facebookUrl: 'https://facebook.com',
      instagramUrl: 'https://instagram.com',
      linkedInUrl: 'https://linkedin.com',
      youtubeUrl: 'https://youtube.com',
      tags: ['premium', 'merchant', 'certified'],
      seoTitle: `${cleanName} Bangladesh | Official Store`,
      seoDescription: `Shop official authentic products from ${cleanName} on Choosify. Free delivery and brand warrantee.`,
      seoKeywords: 'official store, authentic, warranty',
      canonicalUrl: `https://choosify.com.bd/brands/${id}`,
      openGraphImage: '',
      indexingToggle: true,
      featuredBrandToggle: false,
      visibilityStatus: 'Published' as const,
      status: 'VERIFIED_OWNER' as const,
      ownerSellerId: 'seller_001',
      badge: 'Verified Brand Owner' as const,
      showLogo: true,
      showOverview: true,
      showWebsite: true,
      showSocialLinks: true,
      showCategory: true,
      showIndustry: true,
      showOwnershipStatus: true,
      showClaimButton: false,
      showVerificationBadge: true,
      pageViews: 1240,
      claimAttempts: 0,
      referralTraffic: 310,
      searchVisibility: 88,
      completionScore: 92
    };
  }, [profiles, id]);

  // Current active sub-tab
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ----- TAB 1 LAYOUT STATES & ACTIONS -----
  const [merchantContact, setMerchantContact] = useState({
    repName: 'Rahim Uddin',
    busEmail: 'merchant.ops@partner-choosify.com',
    phone: '01711-554488',
    logoUrl: brandProfile.logo,
    address: 'Aarong Corporate HQ, 34 Bir Uttam AK Khandakar Road, Mohakhali C/A, Dhaka-1212'
  });

  const [notifications, setNotifications] = useState({
    push: true,
    weeklyReport: true,
    emailAlerts: true,
    phoneSms: false
  });

  const [authControls, setAuthControls] = useState({
    twoFactor: true,
    sessionLapse: true,
    currentPass: '',
    newPass: '',
    confirmPass: ''
  });

  const [adminControls, setAdminControls] = useState({
    subscriptionType: 'Platinum Enterprise',
    sellerStatus: brandProfile.status === 'SUSPENDED' ? 'Suspended' : 'Verified',
    isActive: brandProfile.status !== 'SUSPENDED',
    allowAds: true,
    allowStoreCustomization: true,
    allowDirectMessaging: true
  });

  const saveIdentity = () => {
    showToast('✓ Merchant Contact & Identity settings updated successfully.');
    addLog(brandProfile.id, brandProfile.name, 'Admin (Workspace)', 'Update Contact Profile', 'Modified corporate representative communications channel configuration.');
  };

  const saveAlerts = () => {
    showToast('✓ Communication Routing & Push channels saved.');
  };

  const saveAuthCreds = () => {
    if (authControls.newPass !== authControls.confirmPass) {
      showToast('❌ Passwords do not match!');
      return;
    }
    showToast('✓ Credentials modified. Active system security logs refreshed.');
    setAuthControls(prev => ({ ...prev, currentPass: '', newPass: '', confirmPass: '' }));
  };

  const saveAdminControls = () => {
    const isSuspended = adminControls.sellerStatus === 'Suspended' || !adminControls.isActive;
    updateProfile(brandProfile.id, { 
      status: isSuspended ? 'SUSPENDED' : 'VERIFIED_OWNER',
      badge: isSuspended ? 'Unclaimed Brand Profile' : 'Verified Brand Owner'
    });
    showToast('🛡️ Core portal access rules and subscription scope updated.');
    addLog(brandProfile.id, brandProfile.name, 'Admin (Workspace)', 'Role Access Modified', `Seller set to ${adminControls.sellerStatus} with ${adminControls.subscriptionType} credentials.`);
  };

  // ----- TAB 2 LAYOUT STATES & ACTIONS -----
  const [kycChecks, setKycChecks] = useState({
    nid: 'Approved',
    kyc: 'Approved',
    tradeLicense: 'Approved',
    vat: 'Approved',
    tin: 'Approved',
    bank: 'Pending'
  });

  const [documentItems, setDocumentItems] = useState([
    { name: 'Trade License (NBR Verified)', type: 'Trade License', date: '2026-06-12', size: '2.4 MB', status: 'Approved' },
    { name: 'NID Representative Double-Sided Scan', type: 'NID Verification', date: '2026-06-12', size: '1.2 MB', status: 'Approved' },
    { name: 'VAT Registration & Business Tax-TIN Certificate', type: 'VAT Registration', date: '2026-06-13', size: '1.8 MB', status: 'Approved' },
    { name: 'Official Bank Attestation Certificate', type: 'Bank Verification', date: '2026-06-14', size: '1.1 MB', status: 'Pending' },
    { name: 'Supporting Power of Attorney / Trademark Notary', type: 'Trademark Notary', date: '2026-06-14', size: '4.8 MB', status: 'Pending' }
  ]);

  const [reviewNotes, setReviewNotes] = useState('Trademark verification pending. Trade license authenticated from NBR portal. Official rep certified through NID validation.');

  const updateDocStatus = (index: number, newStatus: string) => {
    setDocumentItems(prev => prev.map((doc, idx) => {
      if (idx === index) {
        return { ...doc, status: newStatus };
      }
      return doc;
    }));
    showToast(`✓ Document updated to [${newStatus}]`);
  };

  const updateChecklistStatus = (key: keyof typeof kycChecks, newStatus: string) => {
    setKycChecks(prev => ({ ...prev, [key]: newStatus }));
    showToast(`✓ Checklist item updated to [${newStatus}]`);
  };

  // ----- TAB 3 LAYOUT STATES & ACTIONS -----
  const [brandStory, setBrandStory] = useState(brandProfile.description);
  const [facebookLink, setFacebookLink] = useState(brandProfile.facebookUrl);
  const [instaLink, setInstaLink] = useState(brandProfile.instagramUrl);
  const [webLink, setWebLink] = useState(brandProfile.websiteUrl);

  const saveStudioInfo = () => {
    updateProfile(brandProfile.id, {
      description: brandStory,
      facebookUrl: facebookLink,
      instagramUrl: instaLink,
      websiteUrl: webLink
    });
    showToast('✓ My Brand Studio settings updated for this brand.');
  };

  // ----- TAB 4 PRODUCT LISTINGS -----
  const [productSearch, setProductSearch] = useState('');
  const [productFilterStatus, setProductFilterStatus] = useState<'All' | 'Active' | 'Draft' | 'Pending' | 'Rejected' | 'Archived'>('All');

  const [productsList, setProductsList] = useState([
    { id: 'prod_1', name: 'Premium Jamdani Cotton Fusion Sharee', category: 'Fashion & Lifestyle', price: '৳ 14,500', stock: 45, status: 'Active', sku: 'FAS-JAM-001' },
    { id: 'prod_2', name: 'Classic Silk Embroidered Mens Kurta', category: 'Fashion & Lifestyle', price: '৳ 4,800', stock: 82, status: 'Active', sku: 'FAS-KUR-002' },
    { id: 'prod_3', name: 'Handcrafted Heritage Terracotta Vase', category: 'Home Decor', price: '৳ 2,200', stock: 12, status: 'Active', sku: 'HOM-TER-003' },
    { id: 'prod_4', name: 'Embellished Pearl Leather Clutch Bag', category: 'Fashion Accessories', price: '৳ 3,400', stock: 0, status: 'Draft', sku: 'ACC-BAG-004' },
    { id: 'prod_5', name: 'Experimental Organic Herbal Skin Serum', category: 'Beauty & Personal Care', price: '৳ 1,850', stock: 100, status: 'Pending', sku: 'BEA-SER-005' },
    { id: 'prod_6', name: 'Rejected Counterfeit Sneakers (Batch A)', category: 'Footwear', price: '৳ 8,900', stock: 0, status: 'Rejected', sku: 'FOO-SNE-006' }
  ]);

  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase());
      const matchesTab = productFilterStatus === 'All' || p.status === productFilterStatus;
      return matchesSearch && matchesTab;
    });
  }, [productsList, productSearch, productFilterStatus]);

  const toggleProductStatus = (prodId: string) => {
    setProductsList(prev => prev.map(p => {
      if (p.id === prodId) {
        const nextStatus = p.status === 'Active' ? 'Archived' : 'Active';
        return { ...p, status: nextStatus };
      }
      return p;
    }));
    showToast('✓ Product operational state toggled.');
  };

  const removeProduct = (prodId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this product listing from brand profile?')) {
      setProductsList(prev => prev.filter(p => p.id !== prodId));
      showToast('✓ Product deleted.');
    }
  };

  // ----- TAB 5 ORDER HISTORY -----
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('All');

  const [ordersList] = useState([
    { id: 'ORD-2026-9531', customer: 'Farhan Rafiq', product: 'Premium Jamdani Cotton Sharee', amount: '৳ 14,500', status: 'Delivered', date: '2026-06-18', fulfillment: 'Choosify Express' },
    { id: 'ORD-2026-9488', customer: 'Sajid Al Hasan', product: 'Classic Silk Kurta', amount: '৳ 4,800', status: 'In Transit', date: '2026-06-18', fulfillment: 'Merchant Self' },
    { id: 'ORD-2026-9321', customer: 'Tasnim Alam', product: 'Terracotta Vase', amount: '৳ 2,200', status: 'Pending', date: '2026-06-17', fulfillment: 'Choosify Express' },
    { id: 'ORD-2026-9110', customer: 'Arif Rahman', product: 'Classic Silk Kurta x2', amount: '৳ 9,600', status: 'Cancelled', date: '2026-06-15', fulfillment: 'Merchant Self' },
    { id: 'ORD-2026-8974', customer: 'Nila Chowdhury', product: 'Premium Jamdani Cotton Sharee', amount: '৳ 14,500', status: 'Returned', date: '2026-06-10', fulfillment: 'Choosify Express' },
    { id: 'ORD-2026-8840', customer: 'Imran Khan', product: 'Terracotta Vase', amount: '৳ 2,200', status: 'Dispatched', date: '2026-06-08', fulfillment: 'Choosify Express' },
    { id: 'ORD-2026-8730', customer: 'Mehnaz Parveen', product: 'Classic Silk Kurta', amount: '৳ 4,800', status: 'Confirmed', date: '2026-06-05', fulfillment: 'Choosify Express' }
  ]);

  const filteredOrders = useMemo(() => {
    return ordersList.filter(o => {
      const matchesSearch = o.id.includes(orderSearch) || o.customer.toLowerCase().includes(orderSearch.toLowerCase()) || o.product.toLowerCase().includes(orderSearch.toLowerCase());
      const matchesFilter = orderFilterStatus === 'All' || o.status === orderFilterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [ordersList, orderSearch, orderFilterStatus]);

  // ----- TAB 6 REVIEWS & HEALTH SCORE -----
  const ratingDistribution = [
    { stars: '5 Stars', count: 1120 },
    { stars: '4 Stars', count: 240 },
    { stars: '3 Stars', count: 50 },
    { stars: '2 Stars', count: 8 },
    { stars: '1 Star', count: 2 }
  ];

  const complaintsList = [
    { id: 'CMP-942', filer: 'Tahsin Khan', reason: 'Delayed delivery on Eid surge', severity: 'Medium', date: '2026-06-10', status: 'Resolved' },
    { id: 'CMP-881', filer: 'Jamil Ahmed', reason: 'Mismatch in embroidery thread color', severity: 'Low', date: '2026-06-02', status: 'Resolved' },
    { id: 'CMP-740', filer: 'Faria Ahmed', reason: 'Request exchange size mismatch', severity: 'Low', date: '2026-05-18', status: 'Resolved' }
  ];

  // ----- TAB 7 ADS AND DEALS -----
  const adPerformanceData = [
    { day: 'Mon', spend: 800, revenue: 3200 },
    { day: 'Tue', spend: 950, revenue: 4100 },
    { day: 'Wed', spend: 1200, revenue: 6400 },
    { day: 'Thu', spend: 1100, revenue: 5800 },
    { day: 'Fri', spend: 1500, revenue: 8200 },
    { day: 'Sat', spend: 1400, revenue: 7900 },
    { day: 'Sun', spend: 1600, revenue: 9500 },
  ];

  const sponsoredAds = [
    { id: 'ad-01', name: 'Eid Grand Apparel Campaign 2026', type: 'Sponsored Products', budget: '৳ 50,000', spend: '৳ 32,400', impressions: '142.5k', clicks: '8.9k', status: 'Active' },
    { id: 'ad-02', name: 'Summer Kurta Banner Showcase', type: 'Sponsored Banner', budget: '৳ 20,000', spend: '৳ 20,000', impressions: '84.1k', clicks: '4.2k', status: 'Expired' },
    { id: 'ad-03', name: 'Monsoon Heritage Decor Blitz', type: 'Sponsored Products', budget: '৳ 30,000', spend: '৳ 0', impressions: '0', clicks: '0', status: 'Scheduled' }
  ];

  const couponsList = [
    { code: 'EIDHERITAGE', discount: '15% Off', limit: '500 Uses', totalUsed: '342 Uses', status: 'Active' },
    { code: 'WELCOMECRAFT', discount: '৳ 500 Flat', limit: '1000 Uses', totalUsed: '1000 Uses', status: 'Expired' },
    { code: 'MONSOONVIBES', discount: '10% Off', limit: '200 Uses', totalUsed: '0 Uses', status: 'Active' }
  ];

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3.5 rounded-xl shadow-2xl text-xs font-bold tracking-wide border border-slate-700 flex items-center gap-2"
          >
            <Info className="w-4.5 h-4.5 text-app-accent" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header Area */}
      <div className="bg-white border-b border-slate-200 py-6 px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => navigate('/admin/sellers')}
              className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl transition-all shadow-sm active:scale-95"
              id="back_to_sellers_btn"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-inner">
                <img src={brandProfile.logo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{brandProfile.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                    brandProfile.status === 'VERIFIED_OWNER' 
                      ? 'bg-green-50 text-green-600 border-green-200' 
                      : brandProfile.status === 'SUSPENDED'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                  }`}>
                    {brandProfile.status === 'VERIFIED_OWNER' ? 'Verified' : brandProfile.status === 'SUSPENDED' ? 'Suspended' : 'Unclaimed'}
                  </span>
                  <span className="bg-orange-50 text-[#F4631E] border border-orange-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                     <ShieldCheck className="w-3.5 h-3.5 text-[#F4631E]" /> PARTNER STUDIO
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-1.5 font-medium flex items-center gap-2">
                   <Building2 className="w-3.5 h-3.5 text-slate-400" /> {brandProfile.industry} &middot; {brandProfile.category}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <a 
               href={brandProfile.websiteUrl} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 bg-white rounded-lg text-xs font-bold shadow-sm transition-all"
             >
                <Globe className="w-4 h-4 text-slate-400" /> Visit Storefront <ExternalLink className="w-3 h-3" />
             </a>
             <button 
               onClick={() => {
                 setAdminControls(prev => ({ ...prev, sellerStatus: 'Suspended', isActive: false }));
                 updateProfile(brandProfile.id, { status: 'SUSPENDED' });
                 showToast('👮 Regulatory emergency lockdown executed on brand access settings.');
               }}
               className="flex items-center gap-1.5 px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 bg-white rounded-lg text-xs font-bold shadow-sm transition-all"
             >
                <Ban className="w-4 h-4" /> Lock Account
             </button>
          </div>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="max-w-7xl mx-auto px-8 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side Sub-Navigation Drawer / Tabs Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
             <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">STUDIO SECTIONS</div>
             
             {[
               { id: 'account', label: '⚙️ Account Information' },
               { id: 'verification', label: '🧾 Verification Center' },
               { id: 'portfolio', label: '🏬 Brand Portfolio' },
               { id: 'products', label: '📦 Product Listings' },
               { id: 'orders', label: '📜 Order History' },
               { id: 'reviews', label: '🛡️ Reviews & Score' },
               { id: 'marketing', label: '📢 Ads & Deals' }
             ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center justify-between ${
                    activeTab === tab.id 
                      ? 'bg-orange-50 text-[#F4631E] border border-orange-100 shadow-sm shadow-orange-500/5' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`}
                  id={`tab_anchor_${tab.id}`}
                >
                  <span>{tab.label}</span>
                  {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-[#F4631E]" />}
                </button>
             ))}
          </div>

          {/* Sticky Brand Analytics Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
             <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">Completion & Trust</div>
             <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 font-medium mb-1">
                     <span>Profile Strength Index</span>
                     <span className="font-bold text-[#F4631E]">{brandProfile.completionScore}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-[#F4631E] h-full" style={{ width: `${brandProfile.completionScore}%` }} />
                  </div>
                </div>

                <div>
                   <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Onboard Representative</span>
                   <span className="font-bold text-slate-800 block mt-0.5">{merchantContact.repName}</span>
                   <span className="text-slate-500 font-mono text-[11px] block mt-0.5">{merchantContact.busEmail}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Right Side Working Canvas Area */}
        <div className="lg:col-span-3 space-y-8">
           
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.15 }}
               className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
             >
                {/* ACCOUNT INFORMATION TAB */}
                {activeTab === 'account' && (
                  <div className="space-y-8" id="account_information_panel">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">⚙️ Account Information</h2>
                        <p className="text-slate-500 text-xs mt-1">Configure representative credentials, security constraints, subscription profiles and general accessibility rules.</p>
                     </div>

                     {/* Profile Identity */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-5">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Merchant Contact & Identity Settings</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Official Representative Name</label>
                              <input 
                                value={merchantContact.repName} 
                                onChange={(e) => setMerchantContact(prev => ({ ...prev, repName: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Official Business Email</label>
                              <input 
                                value={merchantContact.busEmail} 
                                onChange={(e) => setMerchantContact(prev => ({ ...prev, busEmail: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F4631E] font-mono" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Registered Phone Contact</label>
                              <input 
                                value={merchantContact.phone} 
                                onChange={(e) => setMerchantContact(prev => ({ ...prev, phone: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Profile Logo Photo URL / Asset Link</label>
                              <input 
                                value={merchantContact.logoUrl} 
                                onChange={(e) => setMerchantContact(prev => ({ ...prev, logoUrl: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                           <div className="space-y-1.5 md:col-span-2">
                              <label className="text-slate-600 font-bold">Corporate Registered HQ Address</label>
                              <textarea 
                                rows={2}
                                value={merchantContact.address} 
                                onChange={(e) => setMerchantContact(prev => ({ ...prev, address: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#F4631E] font-medium resize-none" 
                              />
                           </div>
                        </div>

                        <div className="flex justify-end pt-2">
                           <button 
                             onClick={saveIdentity}
                             className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                           >
                             Save Profile Identity
                           </button>
                        </div>
                     </div>

                     {/* Communication Summary settings */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-5">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Merchant Communications & Alert Channels</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                           {[
                             { key: 'push', title: 'Browser Push Notifications', desc: 'Enable native dashboard updates' },
                             { key: 'weeklyReport', title: 'Commerce Summary Reports', desc: 'Get weekly sales volumes and logistics updates' },
                             { key: 'emailAlerts', title: 'Email Routing Channel', desc: 'Route disputes and orders to verified email' },
                             { key: 'phoneSms', title: 'Phone Routing Channel', desc: 'Critical warehouse operations SMS backup' }
                           ].map((item) => (
                              <label key={item.key} className="flex items-start gap-3 bg-white p-4 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-50 transition-all select-none">
                                 <input 
                                   type="checkbox" 
                                   checked={(notifications as any)[item.key]} 
                                   onChange={(e) => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                   className="mt-0.5 accent-[#F4631E]" 
                                 />
                                 <div>
                                    <span className="font-bold text-slate-800 block">{item.title}</span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                                 </div>
                              </label>
                           ))}
                        </div>

                        <div className="flex justify-end">
                           <button 
                             onClick={saveAlerts}
                             className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                           >
                             Save Communication Settings
                           </button>
                        </div>
                     </div>

                     {/* Security settings */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-5">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authorized Access Controls</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                           <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <label className="flex items-center gap-3 bg-white p-4 border border-slate-200/60 rounded-xl cursor-pointer">
                                 <input 
                                   type="checkbox" 
                                   checked={authControls.twoFactor} 
                                   onChange={(e) => setAuthControls(prev => ({ ...prev, twoFactor: e.target.checked }))}
                                   className="accent-[#F4631E]" 
                                 />
                                 <div>
                                    <span className="font-bold text-slate-800 block">Two Factor Authentication (MFA)</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Enforce SMS/OTP verification code upon sign in</span>
                                 </div>
                              </label>

                              <label className="flex items-center gap-3 bg-white p-4 border border-slate-200/60 rounded-xl cursor-pointer">
                                 <input 
                                   type="checkbox" 
                                   checked={authControls.sessionLapse} 
                                   onChange={(e) => setAuthControls(prev => ({ ...prev, sessionLapse: e.target.checked }))}
                                   className="accent-[#F4631E]" 
                                 />
                                 <div>
                                    <span className="font-bold text-slate-800 block">Enforce Inactive Session Timeout</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">Automatically lock console after 15 mins inactivity</span>
                                 </div>
                              </label>
                           </div>

                           <div className="md:col-span-2 border-t border-slate-200 pt-4 space-y-3">
                              <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Password Management</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                 <div className="space-y-1">
                                    <label className="text-slate-500 font-bold">Current Password</label>
                                    <input 
                                      type="password" 
                                      value={authControls.currentPass}
                                      onChange={(e) => setAuthControls(prev => ({ ...prev, currentPass: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E]" 
                                      placeholder="••••••••"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-slate-500 font-bold">New Password</label>
                                    <input 
                                      type="password" 
                                      value={authControls.newPass}
                                      onChange={(e) => setAuthControls(prev => ({ ...prev, newPass: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E]" 
                                      placeholder="••••••••"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-slate-500 font-bold">Confirm New Password</label>
                                    <input 
                                      type="password" 
                                      value={authControls.confirmPass}
                                      onChange={(e) => setAuthControls(prev => ({ ...prev, confirmPass: e.target.value }))}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E]" 
                                      placeholder="••••••••"
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex justify-end">
                           <button 
                             onClick={saveAuthCreds}
                             className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                           >
                             Save Password Credentials
                           </button>
                        </div>
                     </div>

                     {/* Platform Access Controls - Admin Only */}
                     <div className="bg-orange-50/40 border border-orange-200/60 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center gap-2">
                           <Lock className="w-4 h-4 text-[#F4631E]" />
                           <h3 className="text-xs font-extrabold text-[#F4631E] uppercase tracking-wider">Platform Access Controls (Administrative Only)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Subscription Tier Access</label>
                              <select 
                                value={adminControls.subscriptionType} 
                                onChange={(e) => setAdminControls(prev => ({ ...prev, subscriptionType: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none font-bold"
                              >
                                 <option>Platinum Enterprise</option>
                                 <option>Gold Premium Tier</option>
                                 <option>Basic Free Onboarding</option>
                              </select>
                           </div>

                           <div className="space-y-1.5">
                              <label className="text-slate-600 font-bold">Administrative Seller Status</label>
                              <select 
                                value={adminControls.sellerStatus} 
                                onChange={(e) => setAdminControls(prev => ({ ...prev, sellerStatus: e.target.value, isActive: e.target.value !== 'Suspended' }))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none font-bold"
                              >
                                 <option>Verified</option>
                                 <option>Pending Verification</option>
                                 <option>Suspended</option>
                                 <option>Banned</option>
                              </select>
                           </div>

                           <div className="md:col-span-2 border-t border-slate-200/60 pt-4 space-y-3 select-none">
                              <span className="font-bold text-slate-700 block">Feature Access Permissions</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                 <label className="flex items-center gap-2 bg-white px-4 py-2.5 border border-slate-200 rounded-xl cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={adminControls.allowAds} 
                                      onChange={(e) => setAdminControls(prev => ({ ...prev, allowAds: e.target.checked }))}
                                      className="accent-[#F4631E]" 
                                    />
                                    <span className="font-bold text-slate-600">Can Administer Ads</span>
                                 </label>

                                 <label className="flex items-center gap-2 bg-white px-4 py-2.5 border border-slate-200 rounded-xl cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={adminControls.allowStoreCustomization} 
                                      onChange={(e) => setAdminControls(prev => ({ ...prev, allowStoreCustomization: e.target.checked }))}
                                      className="accent-[#F4631E]" 
                                    />
                                    <span className="font-bold text-slate-600">Premium Branding Studio</span>
                                 </label>

                                 <label className="flex items-center gap-2 bg-white px-4 py-2.5 border border-slate-200 rounded-xl cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={adminControls.allowDirectMessaging} 
                                      onChange={(e) => setAdminControls(prev => ({ ...prev, allowDirectMessaging: e.target.checked }))}
                                      className="accent-[#F4631E]" 
                                    />
                                    <span className="font-bold text-slate-600">Direct Chat Access</span>
                                 </label>
                              </div>
                           </div>
                        </div>

                        <div className="flex justify-end pt-2">
                           <button 
                             onClick={saveAdminControls}
                             className="px-6 py-3 bg-[#F4631E] hover:bg-[#eb4501] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                           >
                             Save Access Constraints
                           </button>
                        </div>
                     </div>
                  </div>
                )}


                {/* VERIFICATION CENTER TAB */}
                {activeTab === 'verification' && (
                  <div className="space-y-8" id="verification_center_panel">
                     <div className="flex justify-between items-start">
                        <div>
                           <h2 className="text-xl font-bold text-slate-900 tracking-tight">🧾 Verification Center & KYC</h2>
                           <p className="text-slate-500 text-xs mt-1">Review official representative document filings, license records, tax validations, and signature certifications.</p>
                        </div>
                     </div>

                     {/* Checklist */}
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Verification Checklist</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium">
                           {[
                             { key: 'nid', label: 'NID Verification', value: kycChecks.nid },
                             { key: 'kyc', label: 'KYC Handshake Check', value: kycChecks.kyc },
                             { key: 'tradeLicense', label: 'Trade License Authenticity', value: kycChecks.tradeLicense },
                             { key: 'vat', label: 'VAT Registration NBR Cert', value: kycChecks.vat },
                             { key: 'tin', label: 'NBR TIN Verification', value: kycChecks.tin },
                             { key: 'bank', label: 'Bank Routing Attestation', value: kycChecks.bank },
                           ].map((item) => (
                             <div key={item.key} className="bg-white border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all shadow-sm">
                                <span className="font-bold text-slate-800">{item.label}</span>
                                
                                <div className="mt-3 flex items-center justify-between">
                                   <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                     item.value === 'Approved' ? 'bg-green-50 text-green-600' :
                                     item.value === 'Pending' ? 'bg-yellow-50 text-yellow-600 animate-pulse' :
                                     item.value === 'Rejected' ? 'bg-red-50 text-red-600' :
                                     'bg-slate-50 text-slate-500'
                                   }`}>
                                      {item.value}
                                   </span>
                                   
                                   <select
                                     value={item.value}
                                     onChange={(e) => updateChecklistStatus(item.key as keyof typeof kycChecks, e.target.value)}
                                     className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded p-1 font-bold font-sans cursor-pointer focus:outline-none"
                                   >
                                      <option>Approved</option>
                                      <option>Pending</option>
                                      <option>Rejected</option>
                                      <option>Requires Attention</option>
                                   </select>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Submitted Documents List */}
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Submitted Document Artifacts</h3>
                           <button className="flex items-center gap-1 text-xs text-[#F4631E] hover:underline font-bold">
                              <Plus className="w-3.5 h-3.5" /> Force Upload Link
                           </button>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                           <table className="min-w-full divide-y divide-slate-100 text-xs">
                              <thead>
                                 <tr className="bg-slate-5-0 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left bg-slate-50">
                                    <th className="px-6 py-4">Document / File Name</th>
                                    <th className="px-6 py-4">Verification Type</th>
                                    <th className="px-6 py-4">File Size</th>
                                    <th className="px-6 py-4">Upload Date</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Oversight Action</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                 {documentItems.map((doc, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                          <span className="truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                                       </td>
                                       <td className="px-6 py-4 text-slate-500">{doc.type}</td>
                                       <td className="px-6 py-4 font-mono text-slate-400">{doc.size}</td>
                                       <td className="px-6 py-4 font-mono text-slate-500">{doc.date}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            doc.status === 'Approved' ? 'bg-green-100/60 text-green-700 border border-green-200' :
                                            doc.status === 'Pending' ? 'bg-yellow-100/60 text-yellow-700 border border-yellow-200 animate-pulse' :
                                            'bg-red-100/60 text-red-700 border border-red-200'
                                          }`}>
                                             {doc.status}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <div className="flex gap-1 justify-end">
                                             <button 
                                               onClick={() => updateDocStatus(idx, 'Approved')}
                                               className="px-2 py-1 bg-green-50 hover:bg-green-100/70 text-green-600 rounded text-[9px] font-bold uppercase"
                                             >
                                                Accept
                                             </button>
                                             <button 
                                               onClick={() => updateDocStatus(idx, 'Rejected')}
                                               className="px-2 py-1 bg-red-50 hover:bg-red-100/70 text-red-600 rounded text-[9px] font-bold uppercase"
                                             >
                                                Reject
                                             </button>
                                          </div>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     {/* Internal Review Comments Textbox */}
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Internal KYC Auditor Review Notes</h3>
                        <textarea 
                           rows={3}
                           value={reviewNotes}
                           onChange={(e) => setReviewNotes(e.target.value)}
                           className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-xs focus:outline-none focus:border-[#F4631E] resize-none"
                           placeholder="Auditor notes on NID match and manual vetting..."
                        />
                        <div className="flex justify-end gap-3">
                           <button 
                             onClick={() => {
                               showToast('✓ Dispatched "Request Missing Document Signature" alert to Merchant.');
                               addLog(brandProfile.id, brandProfile.name, 'Admin (Workspace)', 'Signature Requested', 'Initiated manual documentation review pipeline upgrade request.');
                             }}
                             className="px-4 py-2 border border-slate-200 hover:bg-white text-slate-600 rounded-lg text-xs font-bold transition-all bg-white shadow-sm"
                           >
                             Request Additional Docs
                           </button>
                           <button 
                             onClick={() => showToast('✓ Auditor internal review notes saved to blockchain journal.')}
                             className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                           >
                             Save Review Notes
                           </button>
                        </div>
                     </div>
                  </div>
                )}


                {/* BRAND PORTFOLIO TAB */}
                {activeTab === 'portfolio' && (
                  <div className="space-y-8" id="brand_portfolio_panel">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">🏬 Brand Portfolio Configurator</h2>
                        <p className="text-slate-500 text-xs mt-1">This panel mirrors your Seller Dashboard's "My Brand Studio". Manage cover assets, story cards, social indices and portfolio categories.</p>
                     </div>

                     {/* Logo & Cover Banner Showcase */}
                     <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm relative bg-white">
                        <div className="h-44 w-full bg-indigo-900 relative overflow-hidden">
                           <img src={brandProfile.coverImage} className="w-full h-full object-cover opacity-60" />
                           <div className="absolute top-4 right-4 bg-black/40 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-sm">
                              <PhotoCoverCheckIcon className="w-3.5 h-3.5 text-green-400" /> Active Banner Asset
                           </div>
                        </div>
                        <div className="px-6 pb-6 relative flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                           <div className="flex gap-4 items-end -mt-10 relative z-10">
                              <div className="w-20 h-20 bg-white border-4 border-white rounded-2xl overflow-hidden shadow-md flex items-center justify-center">
                                 <img src={brandProfile.logo} className="w-full h-full object-cover" />
                              </div>
                              <div className="pb-1">
                                 <h3 className="text-lg font-black text-slate-900">{brandProfile.name} Studio</h3>
                                 <p className="text-slate-500 text-xs font-semibold">{brandProfile.category}</p>
                              </div>
                           </div>
                           <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg tracking-wide border border-transparent transition-all">
                              Upload Brand Asset
                           </button>
                        </div>
                     </div>

                     {/* Story Writing Panel */}
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Brand Story & Mission statement</h3>
                        <textarea 
                           rows={3}
                           value={brandStory}
                           onChange={(e) => setBrandStory(e.target.value)}
                           className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-xs focus:outline-none focus:border-[#F4631E] resize-none"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                           <div className="space-y-1.5">
                              <label className="text-slate-500 block">Website URL Link</label>
                              <input 
                                value={webLink} 
                                onChange={(e) => setWebLink(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-slate-500 block">Facebook Community</label>
                              <input 
                                value={facebookLink} 
                                onChange={(e) => setFacebookLink(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-slate-500 block">Instagram Handle</label>
                              <input 
                                value={instaLink} 
                                onChange={(e) => setInstaLink(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-medium" 
                              />
                           </div>
                        </div>

                        <div className="flex justify-end pt-2">
                           <button 
                             onClick={saveStudioInfo}
                             className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                           >
                             Save Studio Configuration
                           </button>
                        </div>
                     </div>

                     {/* Social Links List for All Owned Brands */}
                     <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                           <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Associated Sub-Brands & Subsidiaries</h3>
                           <span className="text-[10px] text-slate-400 font-mono">Verified Portfolio Owner count: 1 merchant link</span>
                        </div>

                        {/* List of brands exactly as seller sees them */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="border border-slate-200 rounded-2xl p-4 flex gap-4 items-center bg-white shadow-sm hover:border-[#F4631E]/20 transition-all">
                              <div className="w-12 h-12 rounded-xl bg-[#F4631E]/10 flex items-center justify-center font-bold text-[#F4631E] text-base shrink-0">
                                 {brandProfile.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <span className="font-extrabold text-slate-900 block truncate text-xs">{brandProfile.name}</span>
                                 <span className="text-[10px] text-slate-500 block">{brandProfile.industry} &middot; Active</span>
                              </div>
                              <Link to={`/admin/brands/${brandProfile.id}`} className="text-xs text-[#F4631E] font-black uppercase hover:underline">VET</Link>
                           </div>

                           <div className="border border-slate-200 rounded-2xl p-4 flex gap-4 items-center bg-slate-50/50 border-dashed justify-center text-slate-400">
                              <span className="text-xs font-bold italic">No other registered sub-brands</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}


                {/* PRODUCT LISTINGS TAB */}
                {activeTab === 'products' && (
                  <div className="space-y-8" id="product_listings_panel">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                           <h2 className="text-xl font-bold text-slate-900 tracking-tight">📦 Registered Products</h2>
                           <p className="text-slate-500 text-xs mt-1">Audit active, pending, or blacklisted listings catalogued by this merchant.</p>
                        </div>
                        <button className="bg-[#F4631E] hover:bg-[#eb4501] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/10 self-start md:self-auto">
                           <Plus className="w-4 h-4" /> Register Product
                        </button>
                     </div>

                     {/* Filters and search list */}
                     <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 gap-2">
                           <Search className="w-4 h-4 text-slate-400" />
                           <input 
                             placeholder="Search listings by SKU or title..." 
                             value={productSearch}
                             onChange={(e) => setProductSearch(e.target.value)}
                             className="w-full py-3 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400 font-medium" 
                           />
                        </div>

                        <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                           {['All', 'Active', 'Draft', 'Pending', 'Rejected', 'Archived'].map((status) => (
                              <button
                                key={status}
                                onClick={() => setProductFilterStatus(status as any)}
                                className={`px-4 py-2 rounded-lg text-[10.5px] font-bold tracking-wide uppercase transition-all whitespace-nowrap ${
                                  productFilterStatus === status 
                                    ? 'bg-slate-900 text-white shadow-md' 
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                 {status}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Products Table */}
                     <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                           <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left border-b border-slate-200">
                                 <th className="px-6 py-4">Product details / SKU</th>
                                 <th className="px-6 py-4">Internal Category</th>
                                 <th className="px-6 py-4 text-center">In Stock Volume</th>
                                 <th className="px-6 py-4 text-right">Standard Price</th>
                                 <th className="px-6 py-4 text-center">Status</th>
                                 <th className="px-6 py-4 text-right">Moderator Oversight</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {filteredProducts.length === 0 ? (
                                 <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No products matched query criteria</td>
                                 </tr>
                              ) : (
                                 filteredProducts.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4">
                                          <div>
                                             <span className="font-extrabold text-slate-900 block">{p.name}</span>
                                             <span className="text-[10px] text-slate-400 font-mono block mt-1">SKU: {p.sku}</span>
                                          </div>
                                       </td>
                                       <td className="px-6 py-4 text-slate-500">{p.category}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`font-mono font-bold ${p.stock === 0 ? 'text-red-500' : 'text-slate-800'}`}>
                                             {p.stock} units
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{p.price}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                            p.status === 'Active' ? 'bg-green-50 text-green-600 border border-green-100' :
                                            p.status === 'Draft' ? 'bg-slate-50 text-slate-500' :
                                            p.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 animate-pulse border border-yellow-100' :
                                            'bg-red-50 text-red-600 border border-red-100'
                                          }`}>
                                             {p.status}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <div className="flex gap-1 justify-end">
                                             <Link 
                                               to={`/dashboard/content-studio/products`}
                                               className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                             >
                                                Edit List
                                             </Link>
                                             <button 
                                               onClick={() => toggleProductStatus(p.id)}
                                               className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                 p.status === 'Active' ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-green-50 hover:bg-green-100 text-green-600'
                                               }`}
                                             >
                                                {p.status === 'Active' ? 'Suspend' : 'Resume'}
                                             </button>
                                             <button 
                                               onClick={() => removeProduct(p.id)}
                                               className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                             >
                                                Remove
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
                )}


                {/* ORDER HISTORY TAB */}
                {activeTab === 'orders' && (
                  <div className="space-y-8" id="order_history_panel">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📜 Order History Ledger</h2>
                        <p className="text-slate-500 text-xs mt-1">Unified transactional catalog of retail/B2C trade history managed by this brand.</p>
                     </div>

                     {/* Filters and Search */}
                     <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 gap-2">
                           <Search className="w-4 h-4 text-slate-400" />
                           <input 
                             placeholder="Search transactions by ID, customer name, item..." 
                             value={orderSearch}
                             onChange={(e) => setOrderSearch(e.target.value)}
                             className="w-full py-3 text-xs bg-transparent outline-none text-slate-700 placeholder-slate-400 font-medium" 
                           />
                        </div>

                        <select 
                          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none"
                          value={orderFilterStatus}
                          onChange={(e) => setOrderFilterStatus(e.target.value)}
                        >
                           <option value="All">All statuses</option>
                           <option value="Pending">Pending</option>
                           <option value="Confirmed">Confirmed</option>
                           <option value="Dispatched">Dispatched</option>
                           <option value="In Transit">In Transit</option>
                           <option value="Delivered">Delivered</option>
                           <option value="Cancelled">Cancelled</option>
                           <option value="Returned">Returned</option>
                        </select>
                     </div>

                     {/* Orders Ledger */}
                     <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-100 text-xs">
                           <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left border-b border-slate-200">
                                 <th className="px-6 py-4">Transaction / Order ID</th>
                                 <th className="px-6 py-4">Registered Customer</th>
                                 <th className="px-6 py-4">Items / Products Purchased</th>
                                 <th className="px-6 py-4 text-right">B2C Gross Revenue</th>
                                 <th className="px-6 py-4 text-center">Fulfillment System</th>
                                 <th className="px-6 py-4 text-center">State Indicator</th>
                                 <th className="px-6 py-4 text-right">Administrative</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              {filteredOrders.length === 0 ? (
                                 <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">No historical transactions match criteria.</td>
                                 </tr>
                              ) : (
                                 filteredOrders.map((o) => (
                                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4">
                                          <div>
                                             <span className="font-extrabold text-[#F4631E] block font-mono">{o.id}</span>
                                             <span className="text-[10px] text-slate-400 font-mono block mt-1">Log date: {o.date}</span>
                                          </div>
                                       </td>
                                       <td className="px-6 py-4">
                                          <span className="font-bold text-slate-900 block">{o.customer}</span>
                                       </td>
                                       <td className="px-6 py-4 text-slate-500 truncate max-w-[150px]" title={o.product}>{o.product}</td>
                                       <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{o.amount}</td>
                                       <td className="px-6 py-4 text-center text-slate-500 font-bold">{o.fulfillment}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            o.status === 'Delivered' ? 'bg-green-50 text-green-600' :
                                            o.status === 'Pending' ? 'bg-yellow-50 text-yellow-600 animate-pulse' :
                                            o.status === 'Cancelled' ? 'bg-red-50 text-red-600' :
                                            o.status === 'Returned' ? 'bg-purple-50 text-purple-600' :
                                            'bg-blue-50 text-blue-600'
                                          }`}>
                                             {o.status}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <Link 
                                            to={`/admin/invoice/${o.id}`}
                                            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[9px] font-bold uppercase tracking-wider transition-all"
                                          >
                                             View Tax Invoice
                                          </Link>
                                       </td>
                                    </tr>
                                 ))
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
                )}


                {/* REVIEWS & HEALTH SCORE TAB */}
                {activeTab === 'reviews' && (
                  <div className="space-y-8" id="reviews_and_scores_panel">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">🛡️ Brand Reputation & Health Scoreboard</h2>
                        <p className="text-slate-500 text-xs mt-1">Audit customer trust scorecards, return quotients, fulfillment defects, and active consumer feedback reviews.</p>
                     </div>

                     {/* Rating statistics */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 text-center space-y-2">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Average feedback score</span>
                           <div className="text-4xl font-black text-slate-900 flex items-center justify-center gap-1.5 font-mono">
                              4.8 <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 mb-1" />
                           </div>
                           <span className="text-[10px] text-slate-400 font-mono block">Evaluated from 1,420 total customer feedback profiles</span>
                        </div>

                        {/* Distribution ratings bars */}
                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 md:col-span-2 space-y-2.5 text-xs font-medium text-slate-600">
                           <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Customer Rating Distribution</span>
                           
                           {ratingDistribution.map((dist) => (
                              <div key={dist.stars} className="flex items-center gap-4">
                                 <span className="w-16 font-bold">{dist.stars}</span>
                                 <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div className="bg-[#F4631E] h-full animate-pulse" style={{ width: `${(dist.count / 1420) * 100}%` }} />
                                 </div>
                                 <span className="w-12 text-right font-mono text-slate-400 font-bold">{dist.count}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Operational metrics details */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Historical Operational Metrics</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                           {[
                             { label: 'Fulfillment Rate', value: '98.4%', status: 'excellent' },
                             { label: 'Return Defect Rate', value: '1.2%', status: 'excellent' },
                             { label: 'Cancellation Defect', value: '0.5%', status: 'excellent' },
                             { label: 'Complaint Ratio', value: '0.2%', status: 'excellent' },
                             { label: 'Dispute Resolution', value: '100%', status: 'excellent' },
                             { label: 'Safety Audit Score', value: '95/100', status: 'excellent' }
                           ].map((item, idx) => (
                             <div key={idx} className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wide block">{item.label}</span>
                                <span className="text-lg font-black text-slate-800 block mt-2 font-mono">{item.value}</span>
                                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block mt-1">Excellent</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Core Trust indicators */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider font-sans">Strategic Compliance Grade</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                           <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                              <div>
                                 <span className="text-slate-500 font-bold">Standard Trust Index</span>
                                 <span className="text-2xl font-black text-slate-900 block mt-1 font-mono">96 / 100</span>
                              </div>
                              <Award className="w-8 h-8 text-emerald-500" />
                           </div>

                           <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                              <div>
                                 <span className="text-slate-500 font-bold">In-Market Risk Rating</span>
                                 <span className="text-xl font-black text-emerald-600 block mt-1.5 uppercase tracking-wider">A+ Low Risk</span>
                              </div>
                              <ShieldCheck className="w-8 h-8 text-blue-500" />
                           </div>

                           <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
                              <div>
                                 <span className="text-slate-500 font-bold">Merchant Policy Compliance</span>
                                 <span className="text-2xl font-black text-slate-900 block mt-1 font-mono">98% Verified</span>
                              </div>
                              <CheckCircle className="w-8 h-8 text-purple-500" />
                           </div>
                        </div>
                     </div>

                     {/* Reports List */}
                     <div className="space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Brand Alerts, Flags & Disputes Journal</h3>
                        
                        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                           <table className="min-w-full divide-y divide-slate-100 text-xs">
                              <thead>
                                 <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left border-b border-slate-200">
                                    <th className="px-6 py-4">Log ID</th>
                                    <th className="px-6 py-4">Filing Consumer</th>
                                    <th className="px-6 py-4">Dispute Context</th>
                                    <th className="px-6 py-4">Severity Code</th>
                                    <th className="px-6 py-4">Incident Log Date</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Oversight Action</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                 {complaintsList.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4 font-mono text-slate-500">{c.id}</td>
                                       <td className="px-6 py-4 font-bold text-slate-900">{c.filer}</td>
                                       <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={c.reason}>{c.reason}</td>
                                       <td className="px-6 py-4">
                                          <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                            c.severity === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            c.severity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                            'bg-slate-50 text-slate-500'
                                          }`}>
                                             {c.severity}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 font-mono text-slate-500">{c.date}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className="inline-block bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border border-teal-100">
                                             {c.status}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <button 
                                            onClick={() => showToast('Disputed logs cleared.')}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold uppercase transition-all"
                                          >
                                             Dismiss
                                          </button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
                )}


                {/* ADS AND DEALS TAB */}
                {activeTab === 'marketing' && (
                  <div className="space-y-8" id="ads_and_deals_panel">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">📢 Ads & Marketing Promotions</h2>
                        <p className="text-slate-500 text-xs mt-1">Audit active seller budget caps, scheduled discount deals, and coupon conversions.</p>
                     </div>

                     {/* Sponsored promotion performance stats */}
                     <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Promotional Campaign Volume</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-xs">
                           {[
                             { label: 'Impressions', val: '242.4k', growth: '+12.4%', color: 'text-blue-600' },
                             { label: 'Sponsor Clicks', val: '14.2k', growth: '+8.2%', color: 'text-indigo-600' },
                             { label: 'Coupon Conversions', val: '1.2k', growth: '+15.1%', color: 'text-emerald-600' },
                             { label: 'Platform Spend Cap', val: '৳ 32,400', growth: 'Cap', color: 'text-[#F4631E]' },
                             { label: 'Revenue Generated', val: '৳ 142.5k', growth: 'ROI 4.4x', color: 'text-emerald-700 font-extrabold' }
                           ].map((item, idx) => (
                             <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">{item.label}</span>
                                <span className={`text-lg font-black block mt-2 font-mono ${item.color}`}>{item.val}</span>
                                <span className="text-[9px] text-slate-400 font-bold block mt-1">{item.growth}</span>
                             </div>
                           ))}
                        </div>
                     </div>

                     {/* Sponsored Ads List */}
                     <div className="space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Sponsored Display Campaigns</h3>
                        
                        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                           <table className="min-w-full divide-y divide-slate-100 text-xs">
                              <thead>
                                 <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left border-b border-slate-200">
                                    <th className="px-6 py-4">Campaign Name</th>
                                    <th className="px-6 py-4">Promotion Type</th>
                                    <th className="px-6 py-4 text-right">Budget Limit</th>
                                    <th className="px-6 py-4 text-right">Dispatched Spend</th>
                                    <th className="px-6 py-4 text-center">Impressions</th>
                                    <th className="px-6 py-4 text-center">Clicks</th>
                                    <th className="px-6 py-4 text-center">State</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                 {sponsoredAds.map((ad) => (
                                    <tr key={ad.id} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4 font-bold text-slate-900">{ad.name}</td>
                                       <td className="px-6 py-4 text-slate-500">{ad.type}</td>
                                       <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{ad.budget}</td>
                                       <td className="px-6 py-4 text-right font-mono text-slate-500">{ad.spend}</td>
                                       <td className="px-6 py-4 text-center font-mono">{ad.impressions}</td>
                                       <td className="px-6 py-4 text-center font-mono text-[#F4631E]">{ad.clicks}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            ad.status === 'Active' ? 'bg-green-50 text-green-600 border border-green-100' :
                                            ad.status === 'Scheduled' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            'bg-slate-50 text-slate-400'
                                          }`}>
                                             {ad.status}
                                          </span>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     {/* Active Coupons List */}
                     <div className="space-y-4">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Active Promotional Coupons</h3>
                        
                        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                           <table className="min-w-full divide-y divide-slate-100 text-xs">
                              <thead>
                                 <tr className="bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider text-left border-b border-slate-200">
                                    <th className="px-6 py-4">Promo Coupon Code</th>
                                    <th className="px-6 py-4">Discount Applied</th>
                                    <th className="px-6 py-4 text-center">Usage Ceiling</th>
                                    <th className="px-6 py-4 text-center">Aggregated Claims</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                 {couponsList.map((c) => (
                                    <tr key={c.code} className="hover:bg-slate-50/50 transition-colors">
                                       <td className="px-6 py-4 font-mono font-extrabold text-[#F4631E]">{c.code}</td>
                                       <td className="px-6 py-4 text-slate-900 font-bold">{c.discount}</td>
                                       <td className="px-6 py-4 text-center text-slate-500">{c.limit}</td>
                                       <td className="px-6 py-4 text-center text-[#F4631E] font-bold">{c.totalUsed}</td>
                                       <td className="px-6 py-4 text-center">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            c.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'
                                          }`}>
                                             {c.status}
                                          </span>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>

                     {/* Conversion Performance chart */}
                     <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Historical ROI Tracking & Marketing Conversion</h3>
                        <div className="h-64">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={adPerformanceData}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                 <XAxis dataKey="day" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                 <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                 <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                 <Legend verticalAlign="top" height={36} iconType="circle" />
                                 <Line type="monotone" dataKey="spend" name="Budget Dispatched (৳)" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 6 }} />
                                 <Line type="monotone" dataKey="revenue" name="Storefront Claims Revenue (৳)" stroke="#10b981" strokeWidth={2.5} />
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                     </div>
                  </div>
                )}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Inline non-exported icon helpers
function PhotoCoverCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
