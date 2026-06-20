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

// Import newly refactored tab components matching Seller "My Profile" design rules
import { BrandAccountTab } from '../../components/brand/BrandAccountTab';
import { BrandVerificationTab } from '../../components/brand/BrandVerificationTab';
import { BrandPortfolioTab } from '../../components/brand/BrandPortfolioTab';
import { BrandProductsTab } from '../../components/brand/BrandProductsTab';
import { BrandOrdersTab } from '../../components/brand/BrandOrdersTab';
import { BrandReviewsTab } from '../../components/brand/BrandReviewsTab';
import { BrandMarketingTab } from '../../components/brand/BrandMarketingTab';

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
                  <BrandAccountTab
                    merchantContact={merchantContact}
                    setMerchantContact={setMerchantContact}
                    notifications={notifications}
                    setNotifications={setNotifications}
                    authControls={authControls}
                    setAuthControls={setAuthControls}
                    adminControls={adminControls}
                    setAdminControls={setAdminControls}
                    brandProfile={brandProfile}
                    saveIdentity={saveIdentity}
                    saveAlerts={saveAlerts}
                    saveAuthCreds={saveAuthCreds}
                    saveAdminControls={saveAdminControls}
                    logs={logs}
                    addLog={(action, notes) => addLog(brandProfile.id, brandProfile.name, 'Admin (Workspace)', action, notes)}
                  />
                )}


                {/* VERIFICATION CENTER TAB */}
                {activeTab === 'verification' && (
                  <BrandVerificationTab
                    kycChecks={kycChecks}
                    setKycChecks={setKycChecks}
                    documentItems={documentItems}
                    setDocumentItems={setDocumentItems}
                    reviewNotes={reviewNotes}
                    setReviewNotes={setReviewNotes}
                    brandProfile={brandProfile}
                    updateProfile={updateProfile}
                    updateChecklistStatus={updateChecklistStatus}
                    updateDocStatus={updateDocStatus}
                    showToast={showToast}
                  />
                )}


                {/* BRAND PORTFOLIO TAB */}
                {activeTab === 'portfolio' && (
                  <BrandPortfolioTab
                    brandStory={brandStory}
                    setBrandStory={setBrandStory}
                    webLink={webLink}
                    setWebLink={setWebLink}
                    facebookLink={facebookLink}
                    setFacebookLink={setFacebookLink}
                    instaLink={instaLink}
                    setInstaLink={setInstaLink}
                    brandProfile={brandProfile}
                    saveStudioInfo={saveStudioInfo}
                  />
                )}


                {/* PRODUCT LISTINGS TAB */}
                {activeTab === 'products' && (
                  <BrandProductsTab
                    productSearch={productSearch}
                    setProductSearch={setProductSearch}
                    productFilterStatus={productFilterStatus}
                    setProductFilterStatus={setProductFilterStatus}
                    filteredProducts={filteredProducts}
                    toggleProductStatus={toggleProductStatus}
                    removeProduct={removeProduct}
                    showToast={showToast}
                  />
                )}


                {/* ORDER HISTORY TAB */}
                {activeTab === 'orders' && (
                  <BrandOrdersTab
                    orderSearch={orderSearch}
                    setOrderSearch={setOrderSearch}
                    orderFilterStatus={orderFilterStatus}
                    setOrderFilterStatus={setOrderFilterStatus}
                    filteredOrders={filteredOrders}
                  />
                )}


                {/* REVIEWS & HEALTH SCORE TAB */}
                {activeTab === 'reviews' && (
                  <BrandReviewsTab
                    ratingDistribution={ratingDistribution}
                    complaintsList={complaintsList}
                    showToast={showToast}
                  />
                )}


                {/* ADS AND DEALS TAB */}
                {activeTab === 'marketing' && (
                  <BrandMarketingTab
                    adPerformanceData={adPerformanceData}
                    sponsoredAds={sponsoredAds}
                    couponsList={couponsList}
                    showToast={showToast}
                  />
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
