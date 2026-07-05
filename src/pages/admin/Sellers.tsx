import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  CheckCircle, 
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
  CheckCircle2,
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
  Award
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBrandProfiles, BrandProfile, BrandStatus, VisibilityStatus, BrandBadge, OwnershipClaim, ClaimStatus, BrandAuditLog } from '../../contexts/BrandProfilesContext';
import { BrandIntelligenceCenter } from '../../components/admin/BrandIntelligenceCenter';

type ActiveTab = 'all' | 'requests' | 'active' | 'flagged' | 'suspended' | 'banned' | 'products' | 'deals' | 'claims' | 'verified';

interface SellerItem {
  id: string;
  name: string;
  storeName: string;
  verificationStatus: string;
  brandCount: number;
  brandSummary: string;
  trustScore: number;
  fulfillmentRate: string;
  returnRate: string;
  operationalHealth: 'Excellent' | 'Good' | 'At Risk' | 'Critical';
  lastActive: string;
  applicationStatus: 'Approved' | 'Pending Review' | 'Suspended' | 'Banned';
  riskStatus: 'Low Risk' | 'Medium Risk' | 'High Risk';
  category: string;
  contact: string;
  phone: string;
  revenue: string;
  reportsCount?: number;
}

const initProducts = [
  { id: 'p_1', name: 'Samsung S25 Ultra', category: 'Mobile', seller: 'TechZone BD', price: '৳ 139,999', status: 'Pending', views: 842 },
  { id: 'p_2', name: 'Vision Smart TV 55"', category: 'Electronics', seller: 'Meena Bazar Online', price: '৳ 68,500', status: 'Live', views: 12840 },
  { id: 'p_3', name: 'Aarong Jamdani Saree', category: 'Fashion', seller: 'Aarong Digital Ltd', price: '৳ 4,200', status: 'Flagged', views: 3210 },
  { id: 'p_4', name: 'Walton 2-Door Fridge', category: 'Home', seller: 'Otobi Furniture', price: '৳ 29,990', status: 'Live', views: 8912 },
];

const initDeals = [
  { id: 'dl_1', name: 'Eid Mega Tech Sale 2026', seller: 'TechZone BD', discount: '30% off', category: 'Electronics', expiry: 'May 31, 2026', clicks: '8,420', status: 'Pending' },
  { id: 'dl_2', name: 'Walton AC Summer Flash', seller: 'Otobi Furniture', discount: '40% off', category: 'Home', expiry: '18h left', clicks: '12,100', status: 'Live' },
  { id: 'dl_3', name: 'Aarong Jamdani Weekend', seller: 'Meena Bazar Online', discount: '20% off', category: 'Fashion', expiry: 'Jun 5, 2026', clicks: '4,240', status: 'Live' },
];

export default function SellersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTab = searchParams.get('tab') || 'all';
  const activeTab = (
    searchTab === 'all' || 
    searchTab === 'requests' || 
    searchTab === 'active' || 
    searchTab === 'flagged' || 
    searchTab === 'suspended' || 
    searchTab === 'banned' || 
    searchTab === 'products' || 
    searchTab === 'deals' ||
    searchTab === 'claims' ||
    searchTab === 'verified'
  ) ? searchTab as ActiveTab : 'all';

  const setActiveTab = (tab: ActiveTab) => {
    setSearchParams({ tab });
  };

  const { 
    profiles, 
    claims, 
    logs, 
    createProfile, 
    updateProfile, 
    deleteProfile, 
    reviewClaim,
    addInternalNotes,
    addLog
  } = useBrandProfiles();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, SUSPENDED, FLAGGED, OWNERSHIP_PENDING, VERIFIED, UNCLAIMED
  const [products, setProducts] = useState(initProducts);
  const [deals, setDeals] = useState(initDeals);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBrandIdForIntelligence, setSelectedBrandIdForIntelligence] = useState<string | null>(null);

  // Brand profiles creation/modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  // Claim actions popup modal states
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimReasonInput, setClaimReasonInput] = useState('');
  const [claimNotesInput, setClaimNotesInput] = useState('');
  const [claimActionType, setClaimActionType] = useState<'Approved' | 'Rejected' | 'Under Investigation' | null>(null);

  // New States and Helpers for the Claims review flow (Task 2 & 3)
  const [claimsFilter, setClaimsFilter] = useState<'all' | 'pending' | 'under_review' | 'requires_more_info' | 'approved' | 'rejected'>('all');
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});
  const [docStatus, setDocStatus] = useState<Record<string, Record<string, 'approved' | 'rejected' | 'reupload' | null>>>({});
  const [claimActionTypeMap, setClaimActionTypeMap] = useState<Record<string, 'reject' | 'info' | null>>({});
  const [claimReasonMap, setClaimReasonMap] = useState<Record<string, string>>({});
  const [claimNotesMap, setClaimNotesMap] = useState<Record<string, string>>({});

  const handleDocAction = (claimId: string, docType: string, actionType: 'approved' | 'rejected' | 'reupload') => {
    setDocStatus(prev => {
      const claimDocs = prev[claimId] || {};
      return {
        ...prev,
        [claimId]: {
          ...claimDocs,
          [docType]: actionType
        }
      };
    });
    const statusText = actionType === 'approved' ? 'Approved' : actionType === 'rejected' ? 'Rejected' : 'Re-upload requested for';
    showToast(`✓ ${statusText} ${docType} document for claim ${claimId}`);
  };

  // Brand profile form states
  const initialProfileForm = {
    name: '',
    logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&q=80',
    coverImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
    description: '',
    industry: 'Consumer Goods',
    category: '',
    country: 'Bangladesh',
    websiteUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    linkedInUrl: '',
    youtubeUrl: '',
    tags: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    canonicalUrl: '',
    openGraphImage: '',
    indexingToggle: true,
    featuredBrandToggle: false,
    visibilityStatus: 'Published' as VisibilityStatus,
    status: 'UNCLAIMED' as BrandStatus,
    ownerSellerId: null as string | null,
    badge: 'Unclaimed Brand Profile' as BrandBadge,
    showLogo: true,
    showOverview: true,
    showWebsite: true,
    showSocialLinks: true,
    showCategory: true,
    showIndustry: true,
    showOwnershipStatus: true,
    showClaimButton: true,
    showVerificationBadge: true,
  };

  const [profileForm, setProfileForm] = useState(initialProfileForm);

  // Consolidated Single Permanent Sellers Database
  const [sellersList, setSellersList] = useState<SellerItem[]>([
    { id: '1', name: 'Rahim Uddin', storeName: 'Aarong Digital Ltd', verificationStatus: 'Verified Merchant', brandCount: 3, brandSummary: 'Aarong Fabric, Aarong Craft, Aarong Lifestyle', trustScore: 98, fulfillmentRate: '99.4%', returnRate: '0.5%', operationalHealth: 'Excellent', lastActive: 'Today | 1h ago', applicationStatus: 'Approved', riskStatus: 'Low Risk', category: 'Clothing & Lifestyle', contact: 'Rahim Uddin', phone: '01711-554488', revenue: '৳ 12.4M' },
    { id: '2', name: 'Nadia Akter', storeName: 'Nadia Akter Fashion House', verificationStatus: 'Verified Merchant', brandCount: 1, brandSummary: 'Nadia Traditional Fashion', trustScore: 92, fulfillmentRate: '99.1%', returnRate: '0.8%', operationalHealth: 'Excellent', lastActive: 'Today | 4h ago', applicationStatus: 'Approved', riskStatus: 'Low Risk', category: 'Fashion & Lifestyle', contact: 'Nadia Akter', phone: '+222 01 414 8447', revenue: '৳ 14.8M' },
    { id: '3', name: 'Maksud Alam', storeName: 'Khaas Food Organic Hub', verificationStatus: 'Unverified', brandCount: 1, brandSummary: 'Khaas Food Organic', trustScore: 88, fulfillmentRate: '95.2%', returnRate: '1.5%', operationalHealth: 'Good', lastActive: 'Yesterday', applicationStatus: 'Pending Review', riskStatus: 'Medium Risk', category: 'Food & Restaurants', contact: 'Maksud Alam', phone: '01511-998822', revenue: '৳ 2.1M' },
    { id: '4', name: 'Selina Parvin', storeName: 'Meena Bazar Superstore', verificationStatus: 'Verified Merchant', brandCount: 2, brandSummary: 'Meena FMCG, Meena Fresh', trustScore: 96, fulfillmentRate: '98.5%', returnRate: '1.2%', operationalHealth: 'Excellent', lastActive: 'Today | 2h ago', applicationStatus: 'Approved', riskStatus: 'Low Risk', category: 'Groceries & FMCG', contact: 'Selina Parvin', phone: '01611-334455', revenue: '৳ 4.8M' },
    { id: '5', name: 'Shaheen Ahmed', storeName: 'Anjans Fashion Boutique', verificationStatus: 'Verified Merchant', brandCount: 1, brandSummary: 'Anjans Traditional Wear', trustScore: 94, fulfillmentRate: '96.8%', returnRate: '1.4%', operationalHealth: 'Excellent', lastActive: 'Today | 5h ago', applicationStatus: 'Approved', riskStatus: 'Low Risk', category: 'Fashion & Lifestyle', contact: 'Shaheen Ahmed', phone: '01811-332211', revenue: '৳ 3.2M' },
    { id: '6', name: 'Sabbir Hasan', storeName: 'Otobi Furniture Home', verificationStatus: 'Verified Merchant', brandCount: 1, brandSummary: 'Otobi Living Home', trustScore: 89, fulfillmentRate: '91.2%', returnRate: '2.8%', operationalHealth: 'Good', lastActive: 'Today | 10h ago', applicationStatus: 'Approved', riskStatus: 'Low Risk', category: 'Home & Living', contact: 'Sabbir Hasan', phone: '01712-445566', revenue: '৳ 6.5M' },
    { id: '7', name: 'Ripon Khan', storeName: 'FakeStore BD', verificationStatus: 'Unverified', brandCount: 0, brandSummary: 'None (No Brand Registered)', trustScore: 34, fulfillmentRate: '62.0%', returnRate: '15.4%', operationalHealth: 'Critical', lastActive: '3 weeks ago', applicationStatus: 'Banned', riskStatus: 'High Risk', category: 'General Merchandise', contact: 'Ripon Khan', phone: '01311-667788', revenue: '৳ 240K' },
    { id: '8', name: 'Fahim Ahmed', storeName: 'Gadget Scam Mart', verificationStatus: 'Unverified', brandCount: 1, brandSummary: 'Fake Gadget BD', trustScore: 48, fulfillmentRate: '71.5%', returnRate: '11.2%', operationalHealth: 'Critical', lastActive: '2 days ago', applicationStatus: 'Suspended', riskStatus: 'High Risk', category: 'Electronics', contact: 'Fahim Ahmed', phone: '01411-992211', revenue: '৳ 180K' },
    { id: '9', name: 'Arif Chowdhury', storeName: 'FashionBD Online', verificationStatus: 'Verified Merchant', brandCount: 2, brandSummary: 'FashionBD Collection, LuxeDrape Silk', trustScore: 74, fulfillmentRate: '84.1%', returnRate: '5.6%', operationalHealth: 'At Risk', lastActive: 'Today | 30m ago', applicationStatus: 'Approved', riskStatus: 'High Risk', category: 'Fashion & Accessories', contact: 'Arif Chowdhury', phone: '01911-332244', revenue: '৳ 1.1M', reportsCount: 14 },
    { id: '10', name: 'Munir Patwary', storeName: 'ElectroBD Express', verificationStatus: 'Verified Merchant', brandCount: 2, brandSummary: 'ElectroBD Mobiles, Refurbished Lab', trustScore: 81, fulfillmentRate: '89.5%', returnRate: '4.2%', operationalHealth: 'Good', lastActive: 'Today | 2h ago', applicationStatus: 'Approved', riskStatus: 'Medium Risk', category: 'Refurbished Mobiles', contact: 'Munir Patwary', phone: '01211-558899', revenue: '৳ 3.6M', reportsCount: 5 },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // State manipulation handlers for standard sellers
  const handleApprove = (id: string) => {
    setSellersList(prev => prev.map(s => s.id === id ? { ...s, applicationStatus: 'Approved', verificationStatus: 'Verified Merchant' } : s));
    const seller = sellersList.find(s => s.id === id);
    if (seller) {
      addLog(`seller_${id}`, seller.storeName, 'Global Manager (Admin)', 'Seller Verified & Approved', `Manually authorized raw credentials and approved partner operations.`);
    }
    showToast(`✓ Allowed application and approved ${seller?.storeName || 'Merchant'}. Now permanently verified.`);
  };

  const handleDecline = (id: string) => {
    setSellersList(prev => prev.map(s => s.id === id ? { ...s, applicationStatus: 'Banned', verificationStatus: 'Unverified' } : s));
    const seller = sellersList.find(s => s.id === id);
    if (seller) {
      addLog(`seller_${id}`, seller.storeName, 'Global Manager (Admin)', 'Seller Application Blacklisted', `Disallowed and flagged representative's operational profile.`);
    }
    showToast(`✗ Declined and blacklisted seller application for ${seller?.storeName || 'Merchant'}.`);
  };

  const handleSuspend = (id: string) => {
    setSellersList(prev => prev.map(s => s.id === id ? { ...s, applicationStatus: 'Suspended' } : s));
    const seller = sellersList.find(s => s.id === id);
    if (seller) {
      addLog(`seller_${id}`, seller.storeName, 'Global Manager (Admin)', 'Account Suspended', `Executed regulatory lockdown due to audit investigations.`);
    }
    showToast(`🔒 Suspended active registry status for ${seller?.storeName || 'Merchant'}.`);
  };

  const handleRestore = (id: string) => {
    setSellersList(prev => prev.map(s => s.id === id ? { ...s, applicationStatus: 'Approved' } : s));
    const seller = sellersList.find(s => s.id === id);
    if (seller) {
      addLog(`seller_${id}`, seller.storeName, 'Global Manager (Admin)', 'Account Restored', `Lifted suspension flags and restored operations.`);
    }
    showToast(`✓ Restored active profile for ${seller?.storeName || 'Merchant'}.`);
  };

  const simulateOnboardingWorkflow = (sellerName: string, category: string, productName: string, price: string, isApproved: boolean) => {
    if (isApproved) {
      // Case 2: Approved Brand -> Auto-approve product
      const newProduct = {
        id: `p_sim_${Date.now()}`,
        name: productName,
        category,
        seller: sellerName,
        price,
        status: 'Live',
        views: 0
      };
      setProducts(prev => [newProduct, ...prev]);
      showToast(`✓ AUTO-APPROVED: Approved Brand "${sellerName}" posted "${productName}" directly (Case 2 logic).`);
    } else {
      // Case 1: Unapproved Seller -> Dual verification request
      const newSeller: SellerItem = {
        id: `sel_${Date.now()}`,
        name: 'New Partner Lead',
        storeName: sellerName,
        verificationStatus: 'Unverified',
        brandCount: 1,
        brandSummary: sellerName,
        trustScore: 50,
        fulfillmentRate: '0%',
        returnRate: '0%',
        operationalHealth: 'Good',
        lastActive: 'Just Now',
        applicationStatus: 'Pending Review',
        riskStatus: 'Medium Risk',
        category,
        contact: 'Pending Officer',
        phone: '01888-XXXXXXXX',
        revenue: '৳ 0'
      };
      const newProduct = {
        id: `p_sim_${Date.now()}`,
        name: productName,
        category,
        seller: sellerName,
        price,
        status: 'Pending',
        views: 0
      };
      setSellersList(prev => [newSeller, ...prev]);
      setProducts(prev => [newProduct, ...prev]);
      showToast(`⚠️ DUAL VERIFICATION FLOW TRIGGERED: Created Pending Seller request AND Pending Product Listing request linked to "${sellerName}" (Case 1 logic).`);
    }
  };

  // ONE Source of Truth: Merge pre-onboarding brand profiles and active merchants
  const unifiedBrands = useMemo(() => {
    const brandsFromProfiles = profiles.map(profile => {
      const linkedSeller = sellersList.find(s => 
        s.id === profile.ownerSellerId || 
        s.storeName.toLowerCase() === profile.name.toLowerCase() ||
        profile.ownerSellerId === `seller_00${s.id}` ||
        `seller_00${s.id}` === profile.ownerSellerId
      );

      return {
        id: profile.id,
        isProfileBased: true,
        brandProfile: profile,
        sellerAccount: linkedSeller || null,
        name: profile.name,
        storeName: profile.name,
        category: profile.category || (linkedSeller ? linkedSeller.category : 'General Goods'),
        status: profile.status as BrandStatus, // UNCLAIMED, OWNERSHIP_PENDING, VERIFIED_OWNER, SUSPENDED, ARCHIVED
        // mapped analytics and metadata
        revenue: linkedSeller ? linkedSeller.revenue : '—',
        trustScore: linkedSeller ? linkedSeller.trustScore : 0,
        fulfillmentRate: linkedSeller ? linkedSeller.fulfillmentRate : '—',
        operationalHealth: linkedSeller ? linkedSeller.operationalHealth : 'N/A' as any,
        lastActive: linkedSeller ? linkedSeller.lastActive : 'Pre-boarding',
        applicationStatus: linkedSeller ? linkedSeller.applicationStatus : 'Pending Review' as any,
        verificationStatus: profile.status === 'VERIFIED_OWNER' ? 'Verified Merchant' : 'Unclaimed Profile',
        brandCount: linkedSeller ? linkedSeller.brandCount : 1,
        brandSummary: profile.description || 'Pre-onboarded claimed profile metadata'
      };
    });

    const sellersWithoutProfile = sellersList.filter(seller => {
      return !profiles.some(p => 
        p.ownerSellerId === seller.id || 
        p.ownerSellerId === `seller_00${seller.id}` || 
        p.name.toLowerCase() === seller.storeName.toLowerCase()
      );
    });

    const brandsFromSellers = sellersWithoutProfile.map(seller => {
      let autoStatus: BrandStatus = 'VERIFIED_OWNER';
      if (seller.applicationStatus === 'Suspended') autoStatus = 'SUSPENDED';
      else if (seller.applicationStatus === 'Banned') autoStatus = 'ARCHIVED';
      else if (seller.applicationStatus === 'Pending Review') autoStatus = 'OWNERSHIP_PENDING';

      return {
        id: `brand_seller_${seller.id}`,
        isProfileBased: false,
        brandProfile: null,
        sellerAccount: seller,
        name: seller.storeName,
        storeName: seller.storeName,
        category: seller.category,
        status: autoStatus,
        revenue: seller.revenue,
        trustScore: seller.trustScore,
        fulfillmentRate: seller.fulfillmentRate,
        operationalHealth: seller.operationalHealth,
        lastActive: seller.lastActive,
        applicationStatus: seller.applicationStatus,
        verificationStatus: seller.verificationStatus,
        brandCount: seller.brandCount,
        brandSummary: seller.brandSummary
      };
    });

    return [...brandsFromProfiles, ...brandsFromSellers];
  }, [profiles, sellersList]);

  // Unified Filtering and Search Engine
  const filteredSellers = useMemo(() => {
    return unifiedBrands.filter(brand => {
      // 1. Tab level filtering
      if (activeTab === 'requests') {
        const isPending = brand.status === 'OWNERSHIP_PENDING' || brand.applicationStatus === 'Pending Review';
        if (!isPending) return false;
      } else if (activeTab === 'active') {
        const isActive = brand.status === 'VERIFIED_OWNER' || brand.applicationStatus === 'Approved';
        if (!isActive) return false;
      } else if (activeTab === 'flagged') {
        const isFlagged = brand.status === 'SUSPENDED' || (brand.sellerAccount && brand.sellerAccount.reportsCount && brand.sellerAccount.reportsCount > 0);
        if (!isFlagged) return false;
      } else if (activeTab === 'suspended') {
        const isSusp = brand.status === 'SUSPENDED' || brand.applicationStatus === 'Suspended';
        if (!isSusp) return false;
      } else if (activeTab === 'banned') {
        const isBanned = brand.status === 'ARCHIVED' || brand.applicationStatus === 'Banned';
        if (!isBanned) return false;
      } else if (activeTab === 'verified') {
        const isVerified = brand.status === 'VERIFIED_OWNER' || brand.verificationStatus === 'Verified Merchant';
        if (!isVerified) return false;
      }

      // 2. Extra Dropdown status filters
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && brand.applicationStatus !== 'Approved' && brand.status !== 'VERIFIED_OWNER') return false;
        if (statusFilter === 'SUSPENDED' && brand.status !== 'SUSPENDED' && brand.applicationStatus !== 'Suspended') return false;
        if (statusFilter === 'FLAGGED' && brand.status !== 'SUSPENDED' && (!brand.sellerAccount || !brand.sellerAccount.reportsCount)) return false;
        if (statusFilter === 'OWNERSHIP_PENDING' && brand.status !== 'OWNERSHIP_PENDING') return false;
        if (statusFilter === 'VERIFIED' && brand.status !== 'VERIFIED_OWNER' && brand.verificationStatus !== 'Verified Merchant') return false;
        if (statusFilter === 'UNCLAIMED' && brand.status !== 'UNCLAIMED') return false;
      }

      // 3. Search Keyword query matching
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        
        const matchesBrandName = brand.name.toLowerCase().includes(query);
        const matchesSellerRep = brand.sellerAccount ? brand.sellerAccount.name.toLowerCase().includes(query) : false;
        const matchesStoreName = brand.storeName.toLowerCase().includes(query);
        const matchesCategory = brand.category.toLowerCase().includes(query);
        
        // Business License documents search in claims context
        const matchedClaims = claims.filter(c => c.brandId === brand.id);
        const matchesDocs = matchedClaims.some(c => 
          c.tradeLicense.toLowerCase().includes(query) ||
          c.businessEmail.toLowerCase().includes(query) ||
          c.applicantName.toLowerCase().includes(query)
        );

        if (!matchesBrandName && !matchesSellerRep && !matchesStoreName && !matchesCategory && !matchesDocs) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedBrands, activeTab, statusFilter, searchTerm, claims]);

  // Create Brand Profile handler
  const handleCreateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.description.trim()) {
      showToast('⚠️ Please supply at least a brand name and overview description.');
      return;
    }

    createProfile({
      slug: '',
      name: profileForm.name,
      logo: profileForm.logo,
      coverImage: profileForm.coverImage,
      description: profileForm.description,
      industry: profileForm.industry,
      category: profileForm.category || 'General Goods',
      country: profileForm.country,
      websiteUrl: profileForm.websiteUrl,
      facebookUrl: profileForm.facebookUrl,
      instagramUrl: profileForm.instagramUrl,
      linkedInUrl: profileForm.linkedInUrl,
      youtubeUrl: profileForm.youtubeUrl,
      tags: profileForm.tags ? profileForm.tags.split(',').map(t => t.trim()) : [],
      seoTitle: profileForm.seoTitle || `${profileForm.name} | Verified Brand Overview`,
      seoDescription: profileForm.seoDescription || profileForm.description,
      seoKeywords: profileForm.seoKeywords || `Choosify, ${profileForm.name}, brand, authentic`,
      canonicalUrl: profileForm.canonicalUrl || `https://choosify.com.bd/brands/${profileForm.name.toLowerCase()}`,
      openGraphImage: profileForm.openGraphImage || profileForm.logo,
      indexingToggle: profileForm.indexingToggle,
      featuredBrandToggle: profileForm.featuredBrandToggle,
      visibilityStatus: profileForm.visibilityStatus,
      status: 'UNCLAIMED',
      ownerSellerId: null,
      badge: 'Unclaimed Brand Profile',
      showLogo: profileForm.showLogo,
      showOverview: profileForm.showOverview,
      showWebsite: profileForm.showWebsite,
      showSocialLinks: profileForm.showSocialLinks,
      showCategory: profileForm.showCategory,
      showIndustry: profileForm.showIndustry,
      showOwnershipStatus: profileForm.showOwnershipStatus,
      showClaimButton: true,
      showVerificationBadge: true,
      pageViews: 10,
      claimAttempts: 0,
      referralTraffic: 0,
      searchVisibility: 40,
    });

    setIsCreateModalOpen(false);
    setProfileForm(initialProfileForm);
    showToast(`✓ Created unclaimed brand SEO profile for "${profileForm.name}" successfully.`);
  };

  // Edit Brand Profile triggers
  const handleTriggerEdit = (brandId: string) => {
    const found = profiles.find(p => p.id === brandId);
    if (!found) {
      showToast('⚠️ Brand profile context record not found.');
      return;
    }
    setEditingProfileId(brandId);
    setProfileForm({
      name: found.name,
      logo: found.logo,
      coverImage: found.coverImage,
      description: found.description,
      industry: found.industry,
      category: found.category,
      country: found.country,
      websiteUrl: found.websiteUrl,
      facebookUrl: found.facebookUrl,
      instagramUrl: found.instagramUrl,
      linkedInUrl: found.linkedInUrl,
      youtubeUrl: found.youtubeUrl,
      tags: found.tags.join(', '),
      seoTitle: found.seoTitle,
      seoDescription: found.seoDescription,
      seoKeywords: found.seoKeywords,
      canonicalUrl: found.canonicalUrl,
      openGraphImage: found.openGraphImage,
      indexingToggle: found.indexingToggle,
      featuredBrandToggle: found.featuredBrandToggle,
      visibilityStatus: found.visibilityStatus,
      status: found.status,
      ownerSellerId: found.ownerSellerId,
      badge: found.badge,
      showLogo: found.showLogo,
      showOverview: found.showOverview,
      showWebsite: found.showWebsite,
      showSocialLinks: found.showSocialLinks,
      showCategory: found.showCategory,
      showIndustry: found.showIndustry,
      showOwnershipStatus: found.showOwnershipStatus,
      showClaimButton: found.showClaimButton,
      showVerificationBadge: found.showVerificationBadge,
    });
    setIsEditModalOpen(true);
  };

  const handleEditProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileId) return;

    updateProfile(editingProfileId, {
      name: profileForm.name,
      logo: profileForm.logo,
      coverImage: profileForm.coverImage,
      description: profileForm.description,
      industry: profileForm.industry,
      category: profileForm.category,
      country: profileForm.country,
      websiteUrl: profileForm.websiteUrl,
      facebookUrl: profileForm.facebookUrl,
      instagramUrl: profileForm.instagramUrl,
      linkedInUrl: profileForm.linkedInUrl,
      youtubeUrl: profileForm.youtubeUrl,
      tags: profileForm.tags ? profileForm.tags.split(',').map(t => t.trim()) : [],
      seoTitle: profileForm.seoTitle,
      seoDescription: profileForm.seoDescription,
      seoKeywords: profileForm.seoKeywords,
      canonicalUrl: profileForm.canonicalUrl,
      openGraphImage: profileForm.openGraphImage,
      indexingToggle: profileForm.indexingToggle,
      featuredBrandToggle: profileForm.featuredBrandToggle,
      visibilityStatus: profileForm.visibilityStatus,
      status: profileForm.status,
      showLogo: profileForm.showLogo,
      showOverview: profileForm.showOverview,
      showWebsite: profileForm.showWebsite,
      showSocialLinks: profileForm.showSocialLinks,
      showCategory: profileForm.showCategory,
      showIndustry: profileForm.showIndustry,
      showOwnershipStatus: profileForm.showOwnershipStatus,
      showClaimButton: profileForm.showClaimButton,
      showVerificationBadge: profileForm.showVerificationBadge,
    });

    setIsEditModalOpen(false);
    setEditingProfileId(null);
    setProfileForm(initialProfileForm);
    showToast('✓ Updated brand profile and SEO mappings successfully.');
  };

  // Submit Claim action from admin desk
  const handleReviewClaimTrigger = (claimId: string, actionType: 'Approved' | 'Rejected' | 'Under Investigation') => {
    setSelectedClaimId(claimId);
    setClaimActionType(actionType);
    setClaimReasonInput('');
    setClaimNotesInput('');
  };

  const executeClaimReview = () => {
    if (!selectedClaimId || !claimActionType) return;
    const claim = claims.find(c => c.id === selectedClaimId);
    reviewClaim(
      selectedClaimId, 
      claimActionType as any, 
      'Lead Operations Administrator', 
      claimReasonInput || `Administrative audit oversight determination: ${claimActionType}`, 
      claimNotesInput
    );

    // If approved, sync table seller profile names instantly
    if (claimActionType === 'Approved' && claim) {
      setSellersList(prev => prev.map(s => {
        if (s.id === claim.sellerAccountId || `seller_00${s.id}` === claim.sellerAccountId) {
          return {
            ...s,
            verificationStatus: 'Verified Merchant',
            brandCount: s.brandCount + 1,
            brandSummary: s.brandSummary === 'None (No Brand Registered)' ? claim.brandName : `${s.brandSummary}, ${claim.brandName}`
          };
        }
        return s;
      }));
    }

    setSelectedClaimId(null);
    setClaimActionType(null);
    showToast(`✓ Ownership claim is now marked as "${claimActionType}" dynamically.`);
  };

  // Quick stats calculations
  const totalClaimsCount = claims.length;
  const pendingClaimsCount = claims.filter(c => c.status === 'pending').length;
  const unclaimedProfilesCount = profiles.filter(p => p.status === 'UNCLAIMED').length;

  return (
    <div className="space-y-6 pb-20 text-app-text-primary font-sans animate-in fade-in duration-300">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-app-card border border-[#F4631E] hover:border-emerald-500 text-app-text-primary text-xs font-bold px-5 py-3 rounded-xl shadow-2xl tracking-wide uppercase transition-all">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#F4631E] animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header with Title and Create Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-app-text-primary tracking-tight">Brands Management Studio</h1>
            <span className="text-[9px] bg-[#F4631E]/15 border border-[#F4631E]/20 text-[#F4631E] px-2.5 py-0.5 rounded font-black tracking-widest uppercase font-mono">
              Workspace Consolidation
            </span>
          </div>
          <p className="text-app-text-secondary text-[12px]">Unified brand monitoring directory, pre-merchant SEO profiles builder, claimable funnels, and corporate verification checks.</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black text-[11px] rounded-lg shadow-lg tracking-wide uppercase flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            id="btn_create_brand_profile"
          >
            <Plus className="w-4 h-4" />
            Create Brand Profile
          </button>
        </div>
      </div>

      {/* Interactive Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-app-card rounded-2xl border border-app-border p-4.5 space-y-2.5">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">🏢 Unclaimed Profiles</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-app-text-primary font-mono">{unclaimedProfilesCount}</span>
            <span className="text-[9px] text-[#F4631E] font-semibold">SEO Index Enabled</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="bg-[#F4631E] h-full w-[60%]" />
          </div>
        </div>

        <div className="bg-app-card rounded-2xl border border-app-border p-4.5 space-y-2.5">
          <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">⏳ Claims Awaiting Review</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-amber-500 font-mono">{pendingClaimsCount}</span>
            <span className="text-[10px] text-slate-500 font-mono">Pending Desk SLA</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full w-[45%]" />
          </div>
        </div>

        <div className="bg-app-card rounded-2xl border border-app-border p-4.5 space-y-2.5">
          <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider block">✔️ Verified Ownerships</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-green-400 font-mono">
              {unifiedBrands.filter(b => b.status === 'VERIFIED_OWNER').length}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Secure Connection</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="bg-green-400 h-full w-[78%]" />
          </div>
        </div>

        <div className="bg-app-card rounded-2xl border border-app-border p-4.5 space-y-2.5">
          <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider block">📊 Consolidated Listings</span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black text-app-text-primary font-mono">{unifiedBrands.length}</span>
            <span className="text-[10px] text-green-500 font-semibold">Active & Cataloged</span>
          </div>
          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-[85%]" />
          </div>
        </div>
      </div>

      {/* Tab Nav Selector */}
      <div className="flex border-b border-app-border overflow-x-auto scrollbar-hide gap-1 bg-app-card p-1 rounded-xl border">
        {[
          { id: 'all', label: `👥 All Brands (${unifiedBrands.length})` },
          { id: 'verified', label: `✔️ Verified Brands (${unifiedBrands.filter(b => b.status === 'VERIFIED_OWNER').length})` },
          { id: 'requests', label: `🆕 Requests (${sellersList.filter(s => s.applicationStatus === 'Pending Review').length + claims.filter(c => c.status === 'pending').length})` },
          { id: 'active', label: `🏪 Active Sellers (${sellersList.filter(s => s.applicationStatus === 'Approved').length})` },
          { id: 'claims', label: `📋 Ownership Claims (${claims.length})` },
          { id: 'flagged', label: `🚩 Flagged (${sellersList.filter(s => s.reportsCount && s.reportsCount > 0).length})` },
          { id: 'suspended', label: `🔒 Suspended (${sellersList.filter(s => s.applicationStatus === 'Suspended').length})` },
          { id: 'banned', label: `🚫 Banned (${sellersList.filter(s => s.applicationStatus === 'Banned').length})` },
          { id: 'products', label: '📦 Products Desk' },
          { id: 'deals', label: '🏷️ Flash Campaigns' },
        ].map(tb => (
          <button 
            key={tb.id}
            onClick={() => setActiveTab(tb.id as ActiveTab)}
            className={`px-4.5 py-3.5 text-[10px] font-extrabold uppercase tracking-widest whitespace-nowrap rounded-lg transition-all cursor-pointer${
              activeTab === tb.id 
                ? 'bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent border'
            }`}
            id={`tab-selector-${tb.id}`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* SEARCH AND FILTERS */}
      {(activeTab !== 'products' && activeTab !== 'deals' && activeTab !== 'claims') && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-app-text-secondary absolute left-4.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Brand, Seller, representative name, category or trade license doc id..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-app-card border border-app-border rounded-xl pl-12 pr-6 py-3.5 text-xs text-app-text-primary focus:outline-none focus:border-app-accent placeholder-slate-500 shadow-sm"
              id="search_brands_input"
            />
          </div>

          <div className="flex items-center gap-2 bg-app-card border border-app-border px-3 rounded-xl">
            <Sliders className="w-3.5 h-3.5 text-app-text-secondary" />
            <span className="text-[10px] text-app-text-secondary font-bold uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-app-text-primary font-extrabold uppercase py-1 border-none focus:outline-none focus:ring-0 cursor-pointer"
              id="filter_status_select"
            >
              <option value="ALL" className="bg-app-card text-app-text-primary">All Ledger</option>
              <option value="ACTIVE" className="bg-app-card text-app-text-primary">Active Merchant</option>
              <option value="SUSPENDED" className="bg-app-card text-app-text-primary">Suspended</option>
              <option value="FLAGGED" className="bg-app-card text-app-text-primary">Flagged / Incidents</option>
              <option value="OWNERSHIP_PENDING" className="bg-app-card text-app-text-primary">Ownership Pending</option>
              <option value="VERIFIED" className="bg-app-card text-app-text-primary">Verified Owner</option>
              <option value="UNCLAIMED" className="bg-app-card text-app-text-primary">Unclaimed profiles</option>
            </select>
          </div>
        </div>
      )}

      {/* CORE DISPLAY ROUTER */}
      <div className="grid grid-cols-1 gap-6">

        {/* DIRECTORY TABLE (UNIFIED BRANDS & SELLERS LIST) */}
        {(activeTab !== 'products' && activeTab !== 'deals' && activeTab !== 'claims') && (
          <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto -mx-4 px-4 custom-scrollbar">
              <div className="min-w-[900px]">
                <table className="w-full text-left border-collapse">
                <thead className="bg-white/[0.02] border-b border-app-border text-[9.5px] text-app-text-secondary uppercase tracking-widest font-black">
                  <tr>
                    <th className="p-5">Brand / Business Name</th>
                    <th className="p-5">Representative Seller</th>
                    <th className="p-5 text-center font-mono">Brand Count</th>
                    <th className="p-5">Ownership Status</th>
                    <th className="p-5">Brand Summary / Details</th>
                    <th className="p-5 text-center font-mono">Trust Score</th>
                    <th className="p-5 text-center font-mono">Fulfillment</th>
                    <th className="p-5 text-right font-mono">Revenue</th>
                    <th className="p-5">Last Active</th>
                    <th className="p-5 text-right">Oversight Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-app-text-secondary">
                  {filteredSellers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-app-text-secondary">
                        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <span>No records found in Brand Management Studio matching criteria</span>
                      </td>
                    </tr>
                  ) : (
                    filteredSellers.map(brand => (
                      <tr key={brand.id} className="hover:bg-white/[0.01] transition-colors group">
                        
                        {/* 1. Brand/Business Name */}
                        <td className="p-5 font-bold text-app-text-primary">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-app-border shrink-0 bg-app-bg flex items-center justify-center">
                              {brand.brandProfile ? (
                                <img src={brand.brandProfile.logo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-5 h-5 text-app-text-secondary" />
                              )}
                            </div>
                            <div>
                              <Link 
                                to={`/upe/brand/${brand.id}`}
                                className="text-app-text-primary hover:text-orange-400 cursor-pointer transition-colors block font-black text-sm"
                              >
                                {brand.name}
                              </Link>
                              <span className="text-[10px] text-app-text-secondary font-semibold block mt-1 uppercase tracking-wider">{brand.category}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Representative */}
                        <td className="p-5">
                          {brand.sellerAccount ? (
                            <div>
                              <Link to={`/upe/seller/${brand.sellerAccount.id}`} className="hover:underline text-app-accent-light font-bold">
                                {brand.sellerAccount.name}
                              </Link>
                              <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">{brand.sellerAccount.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic block font-mono">Unclaimed Pre-Merchant</span>
                          )}
                        </td>

                        {/* 3. Brand Count */}
                        <td className="p-5 text-center font-mono font-bold text-app-text-primary">
                          {brand.brandCount}
                        </td>

                        {/* 4. Ownership Status tag */}
                        <td className="p-5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider${
                            brand.status === 'VERIFIED_OWNER' || brand.status === 'VERIFIED'
                              ? 'bg-green-500/10 text-emerald-400 border border-green-500/15'
                              : brand.status === 'OWNERSHIP_PENDING'
                              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
                              : brand.status === 'SUSPENDED'
                              ? 'bg-red-500/10 text-red-500 border border-red-500/15'
                              : 'bg-white/5 text-slate-400 border border-white/5'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full${
                              brand.status === 'VERIFIED_OWNER' || brand.status === 'VERIFIED' ? 'bg-green-400' :
                              brand.status === 'OWNERSHIP_PENDING' ? 'bg-amber-400 animate-pulse' :
                              brand.status === 'SUSPENDED' ? 'bg-red-500' : 'bg-slate-400'
                            }`} />
                            {brand.status.replace('_', ' ')}
                          </span>
                        </td>

                        {/* 5. Brand Summary */}
                        <td className="p-5 text-app-text-secondary max-w-[200px] truncate" title={brand.brandSummary}>
                          {brand.brandSummary}
                        </td>

                        {/* 6. Trust Score */}
                        <td className="p-5 text-center">
                          {brand.sellerAccount ? (
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {brand.trustScore}<span className="text-[10px] text-slate-500">/100</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono">—</span>
                          )}
                        </td>

                        {/* 7. Fulfillment */}
                        <td className="p-5 text-center font-mono font-medium text-app-text-primary">
                          {brand.fulfillmentRate}
                        </td>

                        {/* 8. Revenue */}
                        <td className="p-5 text-right font-mono font-black text-emerald-400">
                          {brand.revenue}
                        </td>

                        {/* 9. Last Active */}
                        <td className="p-5 text-app-text-secondary font-mono text-[10.5px]">
                          {brand.lastActive}
                        </td>

                        {/* 10. Oversight Actions */}
                        <td className="p-5 text-right">
                          <div className="flex gap-1.5 justify-end items-center">
                            
                            <Link 
                              to={`/upe/brand/${brand.id}`}
                              className="p-1 px-2.5 bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E] hover:bg-[#F4631E] hover:text-white rounded-md text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer inline-block text-center"
                              title="Open Brand Management Studio"
                            >
                              Studio
                            </Link>

                            {brand.brandProfile && (
                              <button 
                                onClick={() => handleTriggerEdit(brand.brandProfile!.id)}
                                className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-app-text-secondary border border-app-border rounded-md text-[10.5px] font-black uppercase tracking-wider transition-all"
                                title="Edit Pre-onboarding profile & SEO content"
                              >
                                SEO / Info
                              </button>
                            )}

                            {brand.sellerAccount ? (
                              <>
                                {brand.applicationStatus === 'Pending Review' && (
                                  <>
                                    <button 
                                      onClick={() => handleApprove(brand.sellerAccount!.id)}
                                      className="px-2.5 py-1 bg-green-500 text-app-text-primary font-bold text-[10px] rounded hover:scale-102 cursor-pointer"
                                      title="Approve Merchant application"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={() => handleDecline(brand.sellerAccount!.id)}
                                      className="px-2 py-1 bg-red-500 text-white font-bold text-[10px] rounded hover:scale-102 cursor-pointer"
                                      title="Decline application"
                                    >
                                      ✖
                                    </button>
                                  </>
                                )}

                                {brand.applicationStatus === 'Approved' && (
                                  <button 
                                    onClick={() => handleSuspend(brand.sellerAccount!.id)}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-red-500/10 text-app-text-secondary hover:text-red-500 rounded border border-[#ef4444]/20 font-bold transition-all cursor-pointer"
                                    title="Deactivate and Suspend merchant catalog access"
                                  >
                                    Deactivate
                                  </button>
                                )}

                                {(brand.applicationStatus === 'Suspended' || brand.applicationStatus === 'Banned') && (
                                  <button 
                                    onClick={() => handleRestore(brand.sellerAccount!.id)}
                                    className="px-2.5 py-1 bg-green-500 text-app-text-primary font-bold text-[10px] rounded hover:scale-102 cursor-pointer"
                                    title="Restore active store"
                                  >
                                    Restore
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-2">Lead Only</span>
                            )}
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

        {/* EXPANDED TAB: OWNERSHIP CLAIMS CONSOLE */}
        {activeTab === 'claims' && (() => {
          // Inner calculations
          const total = claims.length;
          const pending = claims.filter(c => c.status === 'pending').length;
          const underReview = claims.filter(c => c.status === 'under_review').length;
          const currentYearMonthPrefix = "2026-06";
          const approvedThisMonth = claims.filter(c => {
            const isApproved = c.status === 'approved';
            const dateStr = c.submittedAt || c.submissionDate;
            return isApproved && dateStr && dateStr.startsWith(currentYearMonthPrefix);
          }).length;

          const filteredClaims = claims.filter(c => {
            if (claimsFilter !== 'all' && c.status !== claimsFilter) {
              return false;
            }
            return true;
          });

          return (
            <div className="space-y-6">
              {/* Claims Moderation Desk Info Banner */}
              <div className="bg-[#F4631E]/5 border border-[#F4631E]/15 rounded-2xl p-6 text-white space-y-3">
                <span className="text-[10px] bg-[#F4631E]/10 border border-[#F4631E]/25 text-[#F4631E] px-2.5 py-1 rounded font-black tracking-widest uppercase block w-fit font-mono">
                  Claims Moderation Desk
                </span>
                <h3 className="text-md font-bold text-app-text-primary tracking-tight">Enterprise Claim Verification Engine</h3>
                <p className="text-xs text-app-text-secondary leading-relaxed">
                  Review submitted Trade certs, verify corporate DNS TXT tokens, look up corporate email matches, and approve profile claim control loops securely. Approved requests automatically link the seller account to the brand.
                </p>
              </div>

              {/* Claims Stat Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-app-card border border-app-border rounded-xl p-4.5">
                  <div className="text-app-text-secondary text-[10px] font-bold uppercase tracking-wider">Total Claims</div>
                  <div className="text-xl font-black text-app-text-primary mt-1 font-mono">{total}</div>
                </div>
                <div className="bg-app-card border border-[#F4631E]/25 rounded-xl p-4.5">
                  <div className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">Pending</div>
                  <div className="text-xl font-black text-amber-400 mt-1 font-mono">{pending}</div>
                </div>
                <div className="bg-app-card border border-app-border rounded-xl p-4.5">
                  <div className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">Under Review</div>
                  <div className="text-xl font-black text-blue-400 mt-1 font-mono">{underReview}</div>
                </div>
                <div className="bg-app-card border border-app-border rounded-xl p-4.5">
                  <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Approved This Month</div>
                  <div className="text-xl font-black text-emerald-400 mt-1 font-mono">{approvedThisMonth}</div>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex border-b border-app-border gap-2 pb-2 overflow-x-auto scrollbar-hide">
                {[
                  { value: 'all', label: 'All claims' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'under_review', label: 'Under Review' },
                  { value: 'requires_more_info', label: 'Requires Logo/Docs (More Info)' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ].map(filterOpt => {
                  const count = filterOpt.value === 'all' 
                    ? claims.length 
                    : claims.filter(c => c.status === filterOpt.value).length;

                  const isActive = claimsFilter === filterOpt.value;

                  return (
                    <button
                      key={filterOpt.value}
                      onClick={() => setClaimsFilter(filterOpt.value as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer${
                        isActive 
                          ? 'bg-[#F4631E]/10 border-[#F4631E]/30 text-[#F4631E]' 
                          : 'bg-app-card border-app-border text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                    >
                      <span>{filterOpt.label}</span>
                      <span className={`px-1.5 py-0.2 text-[9.5px] rounded-full font-bold${
                        isActive ? 'bg-[#F4631E]/25 text-[#F4631E]' : 'bg-white/5 text-slate-400'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Main Workspace Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Claims Left Card List Column */}
                <div className="lg:col-span-2 space-y-4">
                  {filteredClaims.length === 0 ? (
                    <div className="bg-app-card border border-app-border rounded-2xl p-12 text-center text-slate-500">
                      <Sliders className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
                      <p className="text-xs">No brand ownership claims found matching the criteria.</p>
                    </div>
                  ) : (
                    filteredClaims.map(c => {
                      const matchedBrand = profiles.find(p => p.id === c.brandId || p.name.toLowerCase() === c.brandName.toLowerCase());
                      const brandLogo = matchedBrand?.logo || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&q=80';
                      const claimantNameVal = c.claimantName || c.applicantName;
                      const claimantPhoneVal = c.claimantPhone || '01711-554488';
                      const roleBadge = c.role === 'owner' ? 'Owner' : 'Authorized Rep';
                      const licenseStr = c.tradeLicenseNo || c.tradeLicense || '';
                      const maskedLicense = licenseStr.length > 4 ? licenseStr.slice(0, 4) + '***' : 'Not Provided';
                      const businessEmailVal = c.businessEmail || 'Not Provided';
                      const submittedAtVal = c.submittedAt || c.submissionDate;
                      const formattedDate = new Date(submittedAtVal).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' });

                      // Documents Submissions indicators
                      const hasTrade = !!(c.tradeLicenseNo || c.tradeLicense);
                      const hasNid = !!c.nidNumber;
                      const hasBank = !!c.bankName;

                      // Status Styling configs
                      const STATUS_LABELS: Record<string, string> = {
                        pending: 'Pending Review',
                        under_review: 'Under Review',
                        approved: 'Approved',
                        rejected: 'Rejected',
                        requires_more_info: 'Requires More Info',
                      };

                      const statusColors: Record<string, { bg: string, text: string, border: string, dot: string }> = {
                        pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', dot: 'bg-yellow-400' },
                        under_review: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
                        requires_more_info: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' },
                        approved: { bg: 'bg-green-500/10', text: 'text-emerald-400', border: 'border-green-500/20', dot: 'bg-emerald-400' },
                        rejected: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', dot: 'bg-red-500' }
                      };

                      const style = statusColors[c.status] || { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' };
                      const activeDocs = docStatus[c.id] || {};

                      return (
                        <div key={c.id} className="bg-app-card border border-app-border rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-sm">
                          
                          {/* Top Row Header */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-app-border">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl overflow-hidden border border-app-border shrink-0 bg-app-bg flex items-center justify-center">
                                <img src={brandLogo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <h4 className="font-bold text-app-text-primary text-md flex items-center gap-2">
                                  {c.brandName}
                                  <span className={`inline-flex items-center gap-1.5 px-2.2 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wider${style.bg}${style.text}${style.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full${style.dot}${c.status === 'pending' ? 'animate-pulse' : ''}`} />
                                    {STATUS_LABELS[c.status] || c.status}
                                  </span>
                                </h4>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Claim ID: {c.id}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-app-text-secondary text-[10.5px] font-mono">
                              <Calendar className="w-3.5 h-3.5 text-[#F4631E]" />
                              <span>{formattedDate}</span>
                            </div>
                          </div>

                          {/* Quick Facts Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5 p-3.5 bg-white/[0.01] rounded-xl border border-app-border">
                              <span className="text-slate-500 text-[9.5px] font-black uppercase tracking-wider block">Claimant / Representative</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-bold text-app-text-primary">{claimantNameVal}</span>
                                <span className={`text-[8.5px] font-extrabold px-1.5 py-0.2 rounded-md${
                                  c.role === 'owner' ? 'bg-[#1A1A2E] text-orange-400 border border-orange-500/25' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {roleBadge}
                                </span>
                              </div>
                              <p className="text-app-text-secondary font-mono mt-1 text-[11px]">{claimantPhoneVal}</p>
                            </div>

                            <div className="space-y-1.5 p-3.5 bg-white/[0.01] rounded-xl border border-app-border">
                              <span className="text-slate-500 text-[9.5px] font-black uppercase tracking-wider block">Factual Ledger Details</span>
                              <div className="flex justify-between text-app-text-secondary mt-1">
                                <span>Trade License No:</span>
                                <span className="font-mono text-app-text-primary text-[11.5px]">{maskedLicense}</span>
                              </div>
                              <div className="flex justify-between text-app-text-secondary">
                                <span>Official Business Email:</span>
                                <span className="font-mono text-app-text-primary truncate max-w-[150px]" title={businessEmailVal}>{businessEmailVal}</span>
                              </div>
                            </div>
                          </div>

                          {/* Document indicators badges */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[9.5px] text-slate-500 font-black uppercase tracking-wider">Document Checklist:</span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold border${
                                hasTrade 
                                  ? 'bg-green-500/10 text-emerald-400 border-green-500/15' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                              }`}>
                                {hasTrade ? '✓' : '✗'} Trade License
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold border${
                                hasNid 
                                  ? 'bg-green-500/10 text-emerald-400 border-green-500/15' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                              }`}>
                                {hasNid ? '✓' : '✗'} NID Verification
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold border${
                                hasBank 
                                  ? 'bg-green-500/10 text-emerald-400 border-green-500/15' 
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                              }`}>
                                {hasBank ? '✓' : '✗'} Bank Account Details
                              </span>
                            </div>
                          </div>

                          {/* Bottom Action Triggers */}
                          <div className="flex flex-col gap-3 pt-3 border-t border-app-border">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              
                              <button
                                onClick={() => setExpandedClaims(p => ({ ...p, [c.id]: !p[c.id] }))}
                                className="px-3.5 py-1.5 bg-app-bg hover:bg-slate-700 text-app-text-secondary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#F4631E]" />
                                <span>{expandedClaims[c.id] ? 'Hide Documents' : 'Review Documents'}</span>
                              </button>

                              <div className="flex items-center gap-1.5">
                                {c.status === 'pending' || c.status === 'under_review' || c.status === 'requires_more_info' ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        reviewClaim(c.id, 'approved', 'Lead Operations Administrator', 'Administrative Approval');
                                        showToast(`Brand ownership transferred to ${claimantNameVal}`);
                                      }}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg shadow uppercase cursor-pointer"
                                    >
                                      Approve Claim
                                    </button>

                                    <button
                                      onClick={() => setClaimActionTypeMap(p => ({ ...p, [c.id]: p[c.id] === 'reject' ? null : 'reject' }))}
                                      className={`px-3 py-1.5 text-app-text-primary font-extrabold text-[11px] rounded-lg uppercase cursor-pointer${
                                        claimActionTypeMap[c.id] === 'reject' ? 'bg-red-950 text-red-400 border border-red-900/35' : 'bg-red-600 hover:bg-red-700 bg-red-600 hover:bg-red-700'
                                      }`}
                                    >
                                      Reject
                                    </button>

                                    <button
                                      onClick={() => setClaimActionTypeMap(p => ({ ...p, [c.id]: p[c.id] === 'info' ? null : 'info' }))}
                                      className={`px-3 py-1.5 font-extrabold text-[11px] rounded-lg transition-all cursor-pointer${
                                        claimActionTypeMap[c.id] === 'info' ? 'bg-purple-950 text-purple-400 border border-purple-900/35' : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                                      }`}
                                    >
                                      Request Info
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-mono italic">Resolved and locked.</span>
                                )}
                              </div>
                            </div>

                            {/* Inline Note inputs inside selected actions */}
                            {claimActionTypeMap[c.id] === 'reject' && (
                              <div className="p-3.5 bg-red-950/20 border border-red-900/35 rounded-xl space-y-2.5">
                                <span className="text-xs font-black text-red-400 block">Required Refusal Explanation *</span>
                                <input
                                  type="text"
                                  value={claimReasonMap[c.id] || ''}
                                  onChange={(e) => setClaimReasonMap(p => ({ ...p, [c.id]: e.target.value }))}
                                  placeholder="Provide exact refusal reasons..."
                                  className="w-full bg-app-card border border-red-800/45 rounded-lg px-3 py-2.2 text-xs text-app-text-primary focus:outline-none focus:border-red-500"
                                />
                                <div className="flex justify-end gap-2 text-[10.5px]">
                                  <button 
                                    onClick={() => setClaimActionTypeMap(p => ({ ...p, [c.id]: null }))}
                                    className="px-2.5 py-1 text-app-text-secondary hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const r = claimReasonMap[c.id] || '';
                                      if (!r.trim()) {
                                        showToast('⚠️ Refusal reason must be supplied.');
                                        return;
                                      }
                                      reviewClaim(c.id, 'rejected', 'Lead Operations Administrator', r);
                                      showToast(`Rejected ownership request for brand ${c.brandName}`);
                                      setClaimActionTypeMap(p => ({ ...p, [c.id]: null }));
                                    }}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md"
                                  >
                                    Confirm Rejection
                                  </button>
                                </div>
                              </div>
                            )}

                            {claimActionTypeMap[c.id] === 'info' && (
                              <div className="p-3.5 bg-purple-950/20 border border-purple-900/35 rounded-xl space-y-2.5">
                                <span className="text-xs font-black text-purple-400 block">Specify Re-upload or Info Requested *</span>
                                <input
                                  type="text"
                                  value={claimNotesMap[c.id] || ''}
                                  onChange={(e) => setClaimNotesMap(p => ({ ...p, [c.id]: e.target.value }))}
                                  placeholder="e.g. Please provide clear non-glossy scan of Trade license"
                                  className="w-full bg-app-card border border-purple-800/45 rounded-lg px-3 py-2.2 text-xs text-app-text-primary focus:outline-none focus:border-purple-500"
                                />
                                <div className="flex justify-end gap-2 text-[10.5px]">
                                  <button 
                                    onClick={() => setClaimActionTypeMap(p => ({ ...p, [c.id]: null }))}
                                    className="px-2.5 py-1 text-app-text-secondary hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const notes = claimNotesMap[c.id] || '';
                                      if (!notes.trim()) {
                                        showToast('⚠️ Please specify what information is requested.');
                                        return;
                                      }
                                      reviewClaim(c.id, 'requires_more_info', 'Lead Operations Administrator', notes);
                                      showToast(`Information request sent to applicant.`);
                                      setClaimActionTypeMap(p => ({ ...p, [c.id]: null }));
                                    }}
                                    className="px-3 py-1 bg-purple-650 hover:bg-purple-700 text-white font-bold rounded-md"
                                  >
                                    Submit Request
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Interactive Document Checklist Section */}
                            {expandedClaims[c.id] && (
                              <div className="bg-app-bg/10 rounded-xl p-4 border border-app-border space-y-3.5">
                                <h5 className="text-[10px] text-app-text-secondary font-extrabold uppercase tracking-wider">Detailed Interactive Certificate Review</h5>
                                <div className="space-y-2.5">
                                  
                                  {/* Doc 1: Trade registry */}
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-3 bg-white/[0.01] rounded-lg border border-app-border">
                                    <div>
                                      <span className="text-[9.5px] text-slate-500 font-black uppercase">1. Government Trade Registry Certificate</span>
                                      <p className="text-app-text-primary font-mono text-[11px] mt-0.5">License: {licenseStr || 'Unspecified'}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">Attachment name: {c.businessRegistrationDocs || 'trade_license_corp.pdf'}</p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                      {['approved', 'rejected', 'reupload'].map((actType) => (
                                        <button
                                          key={actType}
                                          onClick={() => handleDocAction(c.id, 'trade', actType as any)}
                                          className={`px-2 py-1.2 rounded text-[9.5px] font-black uppercase transition-all cursor-pointer${
                                            activeDocs['trade'] === actType
                                              ? actType === 'approved' ? 'bg-[#1a1a2e] text-[#F97316] border border-[#F97316]/50' : actType === 'rejected' ? 'bg-red-650 text-white' : 'bg-amber-600 text-white'
                                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                          }`}
                                        >
                                          {actType === 'approved' ? 'Approve ✓' : actType === 'rejected' ? 'Reject ✗' : 'Re-upload'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Doc 2: National ID registry */}
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-3 bg-white/[0.01] rounded-lg border border-app-border">
                                    <div>
                                      <span className="text-[9.5px] text-slate-500 font-black uppercase">2. Claimant National ID & Selfie Verification</span>
                                      <p className="text-app-text-primary font-mono text-[11px] mt-0.5">NID: {c.nidNumber || '199026123456789 (Verified format)'}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">Attachments: Front side, back side, selfie card holder</p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                      {['approved', 'rejected', 'reupload'].map((actType) => (
                                        <button
                                          key={actType}
                                          onClick={() => handleDocAction(c.id, 'nid', actType as any)}
                                          className={`px-2 py-1.2 rounded text-[9.5px] font-black uppercase transition-all cursor-pointer${
                                            activeDocs['nid'] === actType
                                              ? actType === 'approved' ? 'bg-[#1a1a2e] text-[#F97316] border border-[#F97316]/50' : actType === 'rejected' ? 'bg-red-650 text-white' : 'bg-amber-600 text-white'
                                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                          }`}
                                        >
                                          {actType === 'approved' ? 'Approve ✓' : actType === 'rejected' ? 'Reject ✗' : 'Re-upload'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Doc 3: Corporate Bank statements */}
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-3 bg-white/[0.01] rounded-lg border border-app-border">
                                    <div>
                                      <span className="text-[9.5px] text-slate-500 font-black uppercase">3. Corporate Bank Account Verification</span>
                                      <p className="text-app-text-primary font-mono text-[11px] mt-0.5 font-bold">Bank Name: {c.bankName || 'Prime Bank PLC'}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">Routing & MICR checked leaf: Yes</p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                      {['approved', 'rejected', 'reupload'].map((actType) => (
                                        <button
                                          key={actType}
                                          onClick={() => handleDocAction(c.id, 'bank', actType as any)}
                                          className={`px-2 py-1.2 rounded text-[9.5px] font-black uppercase transition-all cursor-pointer${
                                            activeDocs['bank'] === actType
                                              ? actType === 'approved' ? 'bg-[#1a1a2e] text-[#F97316] border border-[#F97316]/50' : actType === 'rejected' ? 'bg-red-650 text-white' : 'bg-amber-600 text-white'
                                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                          }`}
                                        >
                                          {actType === 'approved' ? 'Approve ✓' : actType === 'rejected' ? 'Reject ✗' : 'Re-upload'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right Column: Immutable security trail logs */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-4">
                    <div className="border-b border-app-border pb-2.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">🛡️ Studio Audit Security Trail</span>
                      <span className="text-[9.5px] text-app-text-secondary block mt-0.5">Immutable record tracker for compliance operations</span>
                    </div>

                    <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                      {logs.map(lg => (
                        <div key={lg.id} className="p-3 bg-app-bg/55 border border-app-border rounded-lg text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#F4631E] truncate max-w-[120px]">{lg.brandName}</span>
                            <span className="text-[9px] text-slate-500 font-mono">{new Date(lg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-[10px] text-app-text-secondary block font-semibold">{lg.action}</p>
                          <p className="text-[10px] text-slate-500 leading-normal">{lg.reason}</p>
                          <span className="text-[9px] text-slate-600 font-mono block text-right">By {lg.adminUser}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* TAB 9: PRODUCTS WITH SIMULATOR (EXISTING PRESERVED) */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Simulation Board */}
            <div className="bg-[#F4631E]/5 border border-[#F4631E]/15 rounded-2xl p-6 text-white space-y-4">
              <span className="text-[10px] bg-[#F4631E]/10 border border-[#F4631E]/25 text-[#F4631E] px-2.5 py-1 rounded font-black tracking-widest uppercase block w-fit font-mono">
                WORKFLOW SIMULATOR — CASE 1 & CASE 2 RULES (onboarding)
              </span>
              <h3 className="text-md font-bold text-app-text-primary tracking-tight">Interactive Onboarding dual logic verification</h3>
              <p className="text-xs text-app-text-secondary leading-relaxed">
                Experience onboarding rules instantly. Post a product dynamically from an <strong>Approved Brand</strong> to trigger <strong>Case 2 Auto-Approval</strong>, or do so from a <strong>New Seller</strong> to see <strong>Case 1 Dual Pending Registration Requests</strong>.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-app-bg/50 rounded-xl p-4 border border-app-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Approved Brand Product Post</span>
                    <span className="text-[8px] bg-green-500/10 text-green-400 uppercase font-black px-2 py-0.5 rounded border border-green-500/20 font-mono">Case 2 rule</span>
                  </div>
                  <p className="text-[11px] text-app-text-secondary">Approved brand <strong className="text-app-text-primary">Meena Bazar Online</strong> publishes. It skips moderation reviews completely and is posted directly.</p>
                  <button
                    onClick={() => simulateOnboardingWorkflow('Meena Bazar Online', 'Groceries & FMCG', 'Organic Fresh Green Mangoes', '৳ 350', true)}
                    className="w-full py-2 bg-green-500 hover:bg-green-600 text-app-text-primary font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                  >
                    Simulate Case 2 Product Post
                  </button>
                </div>

                <div className="bg-app-bg/50 rounded-xl p-4 border border-app-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-app-text-primary uppercase tracking-wider">New Seller Product Post</span>
                    <span className="text-[8px] bg-orange-500/10 text-orange-400 uppercase font-black px-2 py-0.5 rounded border border-orange-500/20 font-mono">Case 1 rule</span>
                  </div>
                  <p className="text-[11px] text-app-text-secondary">A new unregistered seller <strong className="text-app-text-primary">Jamuna Electronics BD</strong> posts. Creates a pending seller entity AND a pending product block.</p>
                  <button
                    onClick={() => simulateOnboardingWorkflow('Jamuna Electronics BD', 'Electronics & Appliances', 'High energy efficient split 1.5Ton AC', '৳ 54,000', false)}
                    className="w-full py-2 bg-[#F4631E] hover:bg-[#F4631E]/90 text-white font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                  >
                    Simulate Case 1 Product Post (Dual Request)
                  </button>
                </div>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2">Active Catalog & Moderation Desk</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-app-text-primary">
                  <thead>
                    <tr className="border-b border-app-border/60 text-slate-500 font-bold">
                      <th className="py-2.5">ID</th>
                      <th className="py-2.5">Product Name</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Authorized Seller</th>
                      <th className="py-2.5">Unit Price</th>
                      <th className="py-2.5">SLA Check</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-mono text-[10px] text-app-text-secondary">{p.id}</td>
                        <td className="py-3 font-bold">{p.name}</td>
                        <td className="py-3 text-[11px] text-app-text-secondary">{p.category}</td>
                        <td className="py-3 font-extrabold text-[#F4631E]">{p.seller}</td>
                        <td className="py-3 font-mono font-bold">{p.price}</td>
                        <td className="py-3 font-mono text-[10px] text-emerald-400">99.2% green</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase${
                            p.status === 'Live' ? 'bg-green-500/10 border border-green-500/20 text-green-400' :
                            p.status === 'Pending' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400 animate-pulse' :
                            'bg-red-500/10 border border-red-500/20 text-red-500'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono">
                          <div className="flex gap-2 justify-end">
                            {p.status === 'Pending' && (
                              <button 
                                onClick={() => {
                                  setProducts(prev => prev.map(item => item.id === p.id ? { ...item, status: 'Live' } : item));
                                  showToast(`✓ Product "${p.name}" approved. Live instantly.`);
                                }}
                                className="px-2 py-1 bg-green-500 text-app-text-primary font-bold text-[10px] rounded hover:scale-102 cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                  setProducts(products.filter(item => item.id !== p.id));
                                  showToast(`✓ Deleted product "${p.name}" from active list.`);
                              }}
                              className="px-2 py-1 bg-white/5 border border-app-border hover:border-red-500/20 hover:text-red-500 text-[10px] rounded text-app-text-secondary transition-all cursor-pointer"
                            >
                              Delete
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

        {/* TAB 10: DEALS FLASH CAMPAIGNS (EXISTING PRESERVED) */}
        {activeTab === 'deals' && (
          <div className="space-y-6">
            <div className="bg-[#F4631E]/5 border border-[#F4631E]/15 rounded-xl p-5 text-white flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold">Coupon Campaign Desk Room</h4>
                <p className="text-[11px] text-app-text-secondary mt-1">
                  Manage flash discounts and coupons. Verified against active store status.
                </p>
              </div>
              <button
                onClick={() => {
                  const newDl = {
                    id: `dl_${Date.now()}`,
                    name: 'Simulated 50% AC Flash Discount',
                    seller: 'Otobi Furniture',
                    discount: '50% off',
                    category: 'Home',
                    expiry: '2 days left',
                    clicks: '0',
                    status: 'Live'
                  };
                  setDeals(prev => [newDl, ...prev]);
                  showToast('✓ Created new simulated AC campaign flash discount.');
                }}
                className="px-4 py-2 bg-[#F4631E] hover:bg-[#F4631E]/90 rounded-lg text-xs font-mono font-bold text-white shrink-0 active:scale-95 cursor-pointer"
              >
                + Direct Discount Campaign
              </button>
            </div>

            <div className="bg-app-card border border-app-border rounded-xl p-5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-app-border pb-2 mb-3">Coupon Pipeline Directory</span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-app-text-primary">
                  <thead>
                    <tr className="border-b border-app-border text-slate-500 font-bold">
                      <th className="py-2.5">Deal Details</th>
                      <th className="py-2.5">Seller</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Discount Ratio</th>
                      <th className="py-2.5">Remaining Lifetime</th>
                      <th className="py-2.5 text-center">Interactions Count</th>
                      <th className="py-2.5">Status Check</th>
                      <th className="py-2.5 text-right font-mono">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {deals.map(dl => (
                      <tr key={dl.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-bold">{dl.name}</td>
                        <td className="py-3 font-semibold text-[#F4631E]">{dl.seller}</td>
                        <td className="py-3 text-[11px] text-app-text-secondary">{dl.category}</td>
                        <td className="py-3">
                          <span className="bg-red-500/20 text-red-500 border border-red-500/20 font-black px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {dl.discount}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-orange-400">{dl.expiry}</td>
                        <td className="py-3 text-center font-mono text-app-text-secondary">{dl.clicks || 0}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase${
                            dl.status === 'Live' ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' :
                            'bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 animate-pulse'
                          }`}>
                            {dl.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono">
                          <div className="flex justify-end gap-2">
                            {dl.status === 'Pending' && (
                              <button 
                                onClick={() => {
                                  setDeals(prev => prev.map(item => item.id === dl.id ? { ...item, status: 'Live' } : item));
                                  showToast(`✓ Flash campaign "${dl.name}" activated.`);
                                }}
                                className="px-2 py-1 bg-green-500 text-app-text-primary font-bold text-[10px] rounded hover:scale-102 cursor-pointer"
                              >
                                Activate
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setDeals(deals.filter(item => item.id !== dl.id));
                                showToast(`✓ Terminated deal campaign "${dl.name}".`);
                              }}
                              className="px-2 py-1 bg-white/5 text-[#838A95] text-[10px] hover:text-red-500 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                            >
                              Terminate
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

      </div>

      {/* CREATE BRAND PROFILE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-app-card/20 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-white/[0.02] px-6 py-4 border-b border-app-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-400" />
                <h3 className="text-md font-bold text-app-text-primary uppercase tracking-wider">Create Claimable Brand Profile</h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-app-text-secondary hover:text-white p-1 hover:bg-white/5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProfileSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Brand Name (Display Title)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex, Walton Electronics, Aarong Fabrics"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Industry</label>
                  <select
                    value={profileForm.industry}
                    onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  >
                    <option value="Fashion & Lifestyle">Fashion & Lifestyle</option>
                    <option value="Jewelry & Accessories">Jewelry & Accessories</option>
                    <option value="Mobile & Phones">Mobile & Phones</option>
                    <option value="Sporting & Playstation">Sporting & Playstation</option>
                    <option value="Gaming & Entertainment">Gaming & Entertainment</option>
                    <option value="Food & Restaurants">Food & Restaurants</option>
                    <option value="Tech & Electronics">Tech & Electronics</option>
                    <option value="TV & Appliances">TV & Appliances</option>
                    <option value="Home & Living">Home & Living</option>
                    <option value="Baby & Maternity">Baby & Maternity</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Category Area Tags</label>
                  <input
                    type="text"
                    placeholder="e.g. Footwear & Apparel, Electronics, Organics"
                    value={profileForm.category}
                    onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Brand Overview Biography</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Detailed bio illustrating brand values, production heritage and market authenticity..."
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Official Web URL</label>
                  <input
                    type="url"
                    placeholder="https://brandname.com"
                    value={profileForm.websiteUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Country of Origin</label>
                  <input
                    type="text"
                    placeholder="Bangladesh"
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-yellow-500 font-extrabold uppercase tracking-widest font-mono">🔍 SEO Metadata Controls</span>
                    <span className="text-[8px] bg-yellow-500/10 text-yellow-500 uppercase px-1.5 py-0.5 rounded font-black font-mono">Google Crawl Optimized</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] text-app-text-secondary uppercase font-black">Meta Title SEO tag</label>
                      <input
                        type="text"
                        placeholder="Apex BD | Exclusive leather crafts"
                        value={profileForm.seoTitle}
                        onChange={(e) => setProfileForm({ ...profileForm, seoTitle: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-lg p-2 text-[11px] text-app-text-primary focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-app-text-secondary uppercase font-black">Meta Description SEO tag</label>
                      <input
                        type="text"
                        placeholder="Comprehensive list of premium items..."
                        value={profileForm.seoDescription}
                        onChange={(e) => setProfileForm({ ...profileForm, seoDescription: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-lg p-2 text-[11px] text-app-text-primary focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-white/5 text-app-text-secondary rounded-lg text-xs font-bold uppercase hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F4631E] hover:bg-[#F4631E]/90 text-white rounded-lg text-xs font-black uppercase"
                >
                  Publish Pre-Onboarding Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRAND PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-app-card/20 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-white/[0.02] px-6 py-4 border-b border-app-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-400" />
                <h3 className="text-md font-bold text-app-text-primary uppercase tracking-wider">Modify Profile Details & SEO Metadata</h3>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-app-text-secondary hover:text-white p-1 hover:bg-white/5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditProfileSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Brand Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Industry Sector</label>
                  <input
                    type="text"
                    required
                    value={profileForm.industry}
                    onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Market Sub-Category</label>
                  <input
                    type="text"
                    required
                    value={profileForm.category}
                    onChange={(e) => setProfileForm({ ...profileForm, category: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Biography Summary</label>
                  <textarea
                    required
                    rows={3}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Corporate Website</label>
                  <input
                    type="url"
                    value={profileForm.websiteUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-app-text-secondary font-bold uppercase tracking-wider">Country</label>
                  <input
                    type="text"
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* SEO Sub-section */}
                <div className="col-span-2 bg-[#F4631E]/5 p-4 rounded-xl border border-[#F4631E]/10 space-y-3">
                  <span className="text-[10px] text-[#F4631E] font-black uppercase tracking-wider block">🔍 Production SEO & Visibility Configurations</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-app-text-secondary uppercase font-bold">SEO Page Title Tag</label>
                      <input
                        type="text"
                        value={profileForm.seoTitle}
                        onChange={(e) => setProfileForm({ ...profileForm, seoTitle: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-lg p-2 text-[11px] text-app-text-primary focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-app-text-secondary uppercase font-bold">SEO Keywords (Comma Separated)</label>
                      <input
                        type="text"
                        value={profileForm.seoKeywords}
                        onChange={(e) => setProfileForm({ ...profileForm, seoKeywords: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-lg p-2 text-[11px] text-app-text-primary focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] text-app-text-secondary uppercase font-bold">Canonical Search Indexing URL</label>
                      <input
                        type="url"
                        value={profileForm.canonicalUrl}
                        onChange={(e) => setProfileForm({ ...profileForm, canonicalUrl: e.target.value })}
                        className="w-full bg-app-card border border-app-border rounded-lg p-2 text-[11px] text-app-text-primary focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs text-app-text-secondary font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profileForm.indexingToggle}
                        onChange={(e) => setProfileForm({ ...profileForm, indexingToggle: e.target.checked })}
                        className="rounded border-app-border bg-app-card text-orange-500 focus:ring-0"
                      />
                      Enable Search Engine Indexing (Googlebot)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-app-border animate-none">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-white/5 text-app-text-secondary rounded-lg text-xs font-bold uppercase hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F4631E] hover:bg-[#F4631E]/90 text-white rounded-lg text-xs font-black uppercase"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLAIM ACTION MODAL */}
      {selectedClaimId && claimActionType && (
        <div className="fixed inset-0 z-50 bg-app-card/20 flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border bg-white/[0.02] flex justify-between items-center">
              <span className="text-xs font-black uppercase text-app-text-primary tracking-widest">
                Confirm Claim Review Action: {claimActionType}
              </span>
              <button onClick={() => setSelectedClaimId(null)} className="text-app-text-secondary hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-app-text-secondary">
                You are executing an administrative oversight review on ownership claim <strong>{selectedClaimId}</strong> with status <strong>{claimActionType}</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] text-app-text-secondary uppercase font-black">Audit Determination Reason (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Approved. Trademark Registry certificates matched fully..."
                  value={claimReasonInput}
                  onChange={(e) => setClaimReasonInput(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-app-text-secondary uppercase font-black">Internal Operations Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional support logs or security verification tokens..."
                  value={claimNotesInput}
                  onChange={(e) => setClaimNotesInput(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded p-2.5 text-xs text-app-text-primary focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                <button
                  onClick={() => setSelectedClaimId(null)}
                  className="px-3.5 py-1.5 bg-white/5 rounded text-xs text-app-text-secondary hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={executeClaimReview}
                  disabled={!claimReasonInput.trim()}
                  className={`px-4 py-1.5 rounded text-xs font-black uppercase text-app-text-primary${
                    !claimReasonInput.trim() ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                    claimActionType === 'Approved' ? 'bg-green-500 hover:bg-green-600' :
                    claimActionType === 'Rejected' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-purple-500 hover:bg-purple-600'
                  }`}
                >
                  Execute Oversight
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REMOVED DRAWERS */}

    </div>
  );
}
