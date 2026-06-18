import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useContact } from '../../../contexts/ContactInteractionContext';
import { useOrders } from '../../../contexts/OrdersContext';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Package,
  FileText,
  Percent,
  Sliders,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  History,
  Info,
  Check,
  Sparkles,
  Award,
  Plus,
  RefreshCw,
  Ban,
  Eye,
  FileSpreadsheet,
  FileCheck,
  Scale,
  Building2,
  Trash2,
  Edit3,
  Users,
  Globe,
  Copy,
  Settings
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface TopProduct {
  id: string;
  name: string;
  price: string;
  stock: number;
  revenue: string;
  views: string;
  thumbnail: string;
  salesCount: number;
}

interface BrandItem {
  id: string;
  name: string;
  status: 'Approved' | 'Pending' | 'Suspended' | 'Active' | 'Verified';
  trustScore: number;
  productCount: number;
  revenue: string;
  orderCount: number;
  verificationStatus: string;
  creationDate: string;
  category?: string;
  followers?: string;
  followersTrend?: string;
  productsTrend?: string;
  ratingTrend?: string;
  conversionTrend?: string;
  rating?: number;
  conversionRate?: string;
  shortDescription?: string;
  legalEntityId?: string;
  originCountry?: string;
  onboardedSince?: string;
  ownershipInfo?: string;
  sellerTier?: string;
  primaryWarehouse?: string;
  fulfillmentMode?: string;
  deliveryStatus?: string;
  activeCampaigns?: string;
  authenticityRating?: string;
  logisticsCompliance?: string;
  complaintResolution?: string;
  creatorImpact?: string;
}

interface TrustEvent {
  id: string;
  title: string;
  description: string;
  badge: 'Positive' | 'Neutral' | 'Negative';
  timestamp: string;
}

interface ReputationReview {
  id: string;
  author: string;
  score: number;
  comment: string;
  time: string;
}

interface SubmittedDoc {
  id: string;
  name: string;
  status: 'Approved' | 'Rejected' | 'Reviewing';
  uploadDate: string;
  fileSize: string;
  docType: string;
}

interface ReviewComment {
  date: string;
  reviewer: string;
  comment: string;
}

interface SellerProfileData {
  id: string;
  name: string;
  storeName: string;
  owner: string;
  businessType: string;
  status: 'Approved' | 'Suspended' | 'Pending';
  verificationStatus: 'Verified Merchant' | 'Unverified';
  riskStatus: 'Low Risk' | 'Medium Risk' | 'High Risk';
  trustScore: number;
  trustTrend: string;
  sellerTier: string;
  settlementPlan: string;
  lastActive: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl: string;
  category: string;
  registrationDetails: {
    tradeLicense: string;
    vatReg: string;
    taxId: string;
  };
  
  // Operational Health (Section C)
  fulfillmentRate: string;
  returnRate: string;
  complaintRate: string;
  resolutionRate: string;
  cancellationRate: string;
  deliveryPerformance: string;
  customerSatisfaction: string;
  auditScore: string;
  operationalHealthBadge: 'Excellent' | 'Good' | 'At Risk' | 'Critical';
  
  // Revenue & Commerce (Section D)
  revenue: string;
  ordersCount: number;
  avgOrderValue: string;
  repeatPurchaseRate: string;
  productCount: number;
  conversionRate: string;
  growthMetrics: string;
  topProducts: TopProduct[];
  
  // Brand Portfolio (Section B)
  brandPortfolio: BrandItem[];
  
  // Trust & Reputation (Section E)
  trustEvents: TrustEvent[];
  reputationHistory: ReputationReview[];
  riskAlerts: { level: 'High' | 'Medium' | 'Low'; description: string; date: string }[];
  fraudFlags: string;
  policyViolations: string;
  
  // Recent Activities (Section F)
  recentActivities: {
    title: string;
    subtitle: string;
    iconType: 'chat' | 'rating' | 'order' | 'warning' | 'document' | 'admin';
  }[];
  
  // Verification Center (Change 3)
  verificationStatusText: string;
  checklist: {
    identity: 'Passed' | 'Pending' | 'Rejected';
    tradeLicense: 'Passed' | 'Pending' | 'Rejected';
    vatCert: 'Passed' | 'Pending' | 'Rejected';
    bankDetails: 'Passed' | 'Pending' | 'Rejected';
  };
  submittedDocuments: SubmittedDoc[];
  reviewHistory: ReviewComment[];
  applicationTimeline: { stage: string; date: string; status: 'completed' | 'current' | 'pending' }[];
  approvalHistory: { event: string; date: string; note: string }[];
}

export function getDynamicProfile(requestedId: string): SellerProfileData {
  // Pre-mapped baseline list matching Sellers.tsx
  const baselineSellers = [
    { id: '1', name: 'Rahim Uddin', storeName: 'Aarong Digital Ltd', verificationStatus: 'Verified Merchant' as const, brandCount: 3, brandSummary: 'Aarong Fabric, Aarong Craft, Aarong Lifestyle', trustScore: 98, fulfillmentRate: '99.4%', returnRate: '0.5%', operationalHealth: 'Excellent' as const, lastActive: 'Today | 1h ago', applicationStatus: 'Approved' as const, riskStatus: 'Low Risk' as const, category: 'Clothing & Lifestyle', contact: 'Rahim Uddin', phone: '01711-554488', revenue: '৳ 12.4M' },
    { id: '2', name: 'Nadia Akter', storeName: 'Nadia Akter Fashion House', verificationStatus: 'Verified Merchant' as const, brandCount: 1, brandSummary: 'Nadia Traditional Fashion', trustScore: 92, fulfillmentRate: '99.1%', returnRate: '0.8%', operationalHealth: 'Excellent' as const, lastActive: 'Today | 4h ago', applicationStatus: 'Approved' as const, riskStatus: 'Low Risk' as const, category: 'Fashion & Apparel', contact: 'Nadia Akter', phone: '+222 01 414 8447', revenue: '৳ 14.8M' },
    { id: '3', name: 'Maksud Alam', storeName: 'Khaas Food Organic Hub', verificationStatus: 'Unverified' as const, brandCount: 1, brandSummary: 'Khaas Food Organic', trustScore: 88, fulfillmentRate: '95.2%', returnRate: '1.5%', operationalHealth: 'Good' as const, lastActive: 'Yesterday', applicationStatus: 'Pending Review' as const, riskStatus: 'Medium Risk' as const, category: 'Organic Groceries', contact: 'Maksud Alam', phone: '01511-998822', revenue: '৳ 2.1M' },
    { id: '4', name: 'Selina Parvin', storeName: 'Meena Bazar Superstore', verificationStatus: 'Verified Merchant' as const, brandCount: 2, brandSummary: 'Meena FMCG, Meena Fresh', trustScore: 96, fulfillmentRate: '98.5%', returnRate: '1.2%', operationalHealth: 'Excellent' as const, lastActive: 'Today | 2h ago', applicationStatus: 'Approved' as const, riskStatus: 'Low Risk' as const, category: 'Groceries & FMCG', contact: 'Selina Parvin', phone: '01611-334455', revenue: '৳ 4.8M' },
    { id: '5', name: 'Shaheen Ahmed', storeName: 'Anjans Fashion Boutique', verificationStatus: 'Verified Merchant' as const, brandCount: 1, brandSummary: 'Anjans Traditional Wear', trustScore: 94, fulfillmentRate: '96.8%', returnRate: '1.4%', operationalHealth: 'Excellent' as const, lastActive: 'Today | 5h ago', applicationStatus: 'Approved' as const, riskStatus: 'Low Risk' as const, category: 'Fashion & Apparel', contact: 'Shaheen Ahmed', phone: '01811-332211', revenue: '৳ 3.2M' },
    { id: '6', name: 'Sabbir Hasan', storeName: 'Otobi Furniture Home', verificationStatus: 'Verified Merchant' as const, brandCount: 1, brandSummary: 'Otobi Living Home', trustScore: 89, fulfillmentRate: '91.2%', returnRate: '2.8%', operationalHealth: 'Good' as const, lastActive: 'Today | 10h ago', applicationStatus: 'Approved' as const, riskStatus: 'Low Risk' as const, category: 'Home & Living', contact: 'Sabbir Hasan', phone: '01712-445566', revenue: '৳ 6.5M' },
    { id: '7', name: 'Ripon Khan', storeName: 'FakeStore BD', verificationStatus: 'Unverified' as const, brandCount: 0, brandSummary: 'None (No Brand Registered)', trustScore: 34, fulfillmentRate: '62.0%', returnRate: '15.4%', operationalHealth: 'Critical' as const, lastActive: '3 weeks ago', applicationStatus: 'Banned' as const, riskStatus: 'High Risk' as const, category: 'General Merchandise', contact: 'Ripon Khan', phone: '01311-667788', revenue: '৳ 240K' },
    { id: '8', name: 'Fahim Ahmed', storeName: 'Gadget Scam Mart', verificationStatus: 'Unverified' as const, brandCount: 1, brandSummary: 'Fake Gadget BD', trustScore: 48, fulfillmentRate: '71.5%', returnRate: '11.2%', operationalHealth: 'Critical' as const, lastActive: '2 days ago', applicationStatus: 'Suspended' as const, riskStatus: 'High Risk' as const, category: 'Electronics', contact: 'Fahim Ahmed', phone: '01411-992211', revenue: '৳ 180K' },
    { id: '9', name: 'Arif Chowdhury', storeName: 'FashionBD Online', verificationStatus: 'Verified Merchant' as const, brandCount: 2, brandSummary: 'FashionBD Collection, LuxeDrape Silk', trustScore: 74, fulfillmentRate: '84.1%', returnRate: '5.6%', operationalHealth: 'At Risk' as const, lastActive: 'Today | 30m ago', applicationStatus: 'Approved' as const, riskStatus: 'High Risk' as const, category: 'Fashion & Accessories', contact: 'Arif Chowdhury', phone: '01911-332244', revenue: '৳ 1.1M' },
    { id: '10', name: 'Munir Patwary', storeName: 'ElectroBD Express', verificationStatus: 'Verified Merchant' as const, brandCount: 2, brandSummary: 'ElectroBD Mobiles, Refurbished Lab', trustScore: 81, fulfillmentRate: '89.5%', returnRate: '4.2%', operationalHealth: 'Good' as const, lastActive: 'Today | 2h ago', applicationStatus: 'Approved' as const, riskStatus: 'Medium Risk' as const, category: 'Refurbished Mobiles', contact: 'Munir Patwary', phone: '01211-558899', revenue: '৳ 3.6M' },
  ];

  const seller = baselineSellers.find(s => s.id === requestedId || (requestedId === 'seller_001' && s.id === '1')) || {
    id: requestedId,
    name: 'Simulated Merchant Partner',
    storeName: 'Simulated Business Store',
    verificationStatus: 'Verified Merchant' as const,
    brandCount: 1,
    brandSummary: 'Simulated Brand',
    trustScore: 85,
    fulfillmentRate: '95.0%',
    returnRate: '2.0%',
    operationalHealth: 'Good' as const,
    lastActive: 'Just Now',
    applicationStatus: 'Approved' as const,
    riskStatus: 'Low Risk' as const,
    category: 'General Catalog',
    contact: 'Simulated Officer',
    phone: '01711-XXXXXX',
    revenue: '৳ 500K'
  };

  // Convert brandSummary to BrandItem list
  const brands: BrandItem[] = seller.brandSummary === 'None (No Brand Registered)' ? [] : seller.brandSummary.split(',').map((b, idx) => {
    const name = b.trim();
    
    const resolveStatus = (): 'Active' | 'Verified' | 'Suspended' => {
      if (seller.applicationStatus === 'Banned' || seller.applicationStatus === 'Suspended') {
        return 'Suspended';
      }
      return idx % 2 === 0 ? 'Verified' : 'Active';
    };

    const determineCategory = () => {
      if (seller.category.includes('Groceries')) return 'Organic FMCG & Fresh Essentials';
      if (seller.category.includes('Clothing') || seller.category.includes('Fashion')) return 'Apparel & Traditional Weaves';
      if (seller.category.includes('Organic')) return 'Pure Farm Foods';
      if (seller.category.includes('Furniture') || seller.category.includes('Home')) return 'Premium Domestic Furnishings';
      if (seller.category.includes('Electronics') || seller.category.includes('Mobiles') || seller.category.includes('Gadget')) return 'High-Tech Consumer Devices';
      return 'Premium General Catalog';
    };

    const ratingValue = Number((4.2 + (seller.trustScore / 100) * 0.7 - idx * 0.1).toFixed(1));
    const convRate = `${(2.1 + idx * 0.4 + (seller.trustScore / 100) * 1.5).toFixed(1)}%`;
    const prodCount = Math.max(8, Math.floor(seller.trustScore * 0.6) + idx * 4);
    
    return {
      id: `brd_${seller.id}_${idx}`,
      name: name,
      status: resolveStatus(),
      trustScore: Math.min(100, Math.max(0, seller.trustScore - idx * 2)),
      productCount: prodCount,
      revenue: seller.revenue,
      orderCount: Math.max(45, Math.floor(seller.trustScore * 14) + idx * 12),
      verificationStatus: seller.verificationStatus === 'Verified Merchant' ? 'NBR Gold Trust Check' : 'Pending Verification Check',
      creationDate: 'June 15, 2026',
      category: determineCategory(),
      followers: (Math.max(1200, 2400 * (idx + 1) + seller.trustScore * 45)).toLocaleString(),
      followersTrend: `+${(4.8 + idx * 1.2).toFixed(1)}%`,
      productsTrend: `+${(2.4 + idx * 0.6).toFixed(1)}%`,
      ratingTrend: `+${(0.4 + idx * 0.1).toFixed(1)}%`,
      conversionTrend: `+${(1.2 + idx * 0.3).toFixed(1)}%`,
      rating: ratingValue,
      conversionRate: convRate,
      shortDescription: `Official flagship representation of ${name}, delivering certified authentic merchandise with fully integrated logistical channels under the Choosify platform guidelines.`,
      legalEntityId: `NBR-BRD-ID-${seller.id}0${idx}84`,
      originCountry: idx % 2 === 0 ? 'Bangladesh' : 'Global Import',
      onboardedSince: 'June 2026',
      ownershipInfo: `Owned by ${seller.name} (${seller.storeName})`,
      sellerTier: seller.trustScore >= 95 ? 'Platinum Elite Partner' : seller.trustScore >= 85 ? 'Gold Star Merchant' : 'Standard Tier',
      
      // Logistics & Operations
      primaryWarehouse: idx % 2 === 0 ? 'Dhaka Central Hub A' : 'Chittagong Distribution Center',
      fulfillmentMode: 'Choosify Express Direct',
      deliveryStatus: 'A-Grade Hub Efficiency (Active)',
      activeCampaigns: idx % 2 === 0 ? 'Eid Festival, Monsoon Special' : 'FMCG Mega Fair',
      
      // Custom Trust Scores
      authenticityRating: `${Math.min(100, Math.floor(seller.trustScore - idx * 1.5))}%`,
      logisticsCompliance: `${Math.min(100, Math.floor(seller.trustScore - 2 - idx))}%`,
      complaintResolution: `${Math.min(100, Math.floor(seller.trustScore - idx * 0.5))}%`,
      creatorImpact: `${Math.min(100, Math.floor(seller.trustScore - 4 + idx))}%`
    };
  });

  return {
    id: seller.id,
    name: seller.name,
    storeName: seller.storeName,
    owner: seller.name,
    businessType: 'Private Corporate Entity',
    status: (seller.applicationStatus === 'Banned' ? 'Suspended' : seller.applicationStatus === 'Pending Review' ? 'Pending' : seller.applicationStatus) as 'Approved' | 'Suspended' | 'Pending',
    verificationStatus: seller.verificationStatus === 'Verified Merchant' ? 'Verified Merchant' : 'Unverified',
    riskStatus: seller.riskStatus,
    trustScore: seller.trustScore,
    trustTrend: 'Stable (calculated dynamically)',
    sellerTier: seller.trustScore >= 95 ? 'Platinum Elite Partner' : seller.trustScore >= 85 ? 'Gold Star Merchant' : 'Standard Tier',
    settlementPlan: 'Weekly SCB Bank Transfer',
    lastActive: seller.lastActive,
    email: `${seller.name.toLowerCase().replace(/\s/g, '')}@choosifyseller.bd`,
    phone: seller.phone,
    address: 'Dhaka Commercial Hub, Bangladesh',
    avatarUrl: seller.name.includes('Akter') || seller.name.includes('Parvin') 
      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256&h=256'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256',
    category: `${seller.category} (Approved Business Entity)`,
    registrationDetails: {
      tradeLicense: `TR-2026-REG-${seller.id}099`,
      vatReg: `VAT-NBR-VAT${seller.id}4739`,
      taxId: `TIN-NBR-TIN${seller.id}1284`
    },
    fulfillmentRate: seller.fulfillmentRate,
    returnRate: seller.returnRate,
    complaintRate: '0.12%',
    resolutionRate: '98.5%',
    cancellationRate: '0.45%',
    deliveryPerformance: 'A-Grade Hub Efficiency',
    customerSatisfaction: '4.7/5.0 Stars',
    auditScore: `${seller.trustScore}/100 Score`,
    operationalHealthBadge: (seller.operationalHealth === 'Excellent' ? 'Excellent' : seller.operationalHealth === 'Good' ? 'Good' : 'Critical') as 'Excellent' | 'Good' | 'At Risk' | 'Critical',
    revenue: seller.revenue,
    ordersCount: Math.max(50, Math.floor(seller.trustScore * 15)),
    avgOrderValue: '৳ 4,200',
    repeatPurchaseRate: '24.5%',
    productCount: Math.max(12, Math.floor(seller.trustScore * 0.8)),
    conversionRate: '3.1%',
    growthMetrics: '+6.8% MoM positive',
    topProducts: [
      { id: '101', name: `${seller.category} Premium Item`, price: '৳ 1,450', stock: 45, revenue: seller.revenue, views: '1,200 views', thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80', salesCount: 84 },
      { id: '102', name: `${seller.category} Standard Selection`, price: '৳ 950', stock: 120, revenue: '৳ 114,000', views: '2,400 views', thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', salesCount: 120 }
    ],
    brandPortfolio: brands,
    trustEvents: [
      { id: 'te-1', title: 'System Audited Compliance Stamp', description: 'Passed the integrated security, fulfillment and trademark verification sweep without flags.', badge: 'Positive' as const, timestamp: seller.lastActive }
    ],
    reputationHistory: [
      { id: 'rep-1', author: 'Government Trademark Watchdog', score: 5, comment: 'Direct NBR database mapping confirms authentic registry and clear business standing.', time: '1 month ago' }
    ],
    riskAlerts: [],
    fraudFlags: 'None',
    policyViolations: 'None',
    recentActivities: [
      { title: 'Unified Compliance Review Completed', subtitle: seller.lastActive, iconType: 'admin' as const },
      { title: 'Brand Metadata Synced Securely', subtitle: 'June 2026', iconType: 'document' as const }
    ],
    verificationStatusText: seller.verificationStatus === 'Verified Merchant' ? 'APPROVED' : 'PENDING REVIEW',
    checklist: {
      identity: (seller.verificationStatus === 'Verified Merchant' ? 'Passed' : 'Pending') as 'Passed' | 'Pending' | 'Rejected',
      tradeLicense: (seller.verificationStatus === 'Verified Merchant' ? 'Passed' : 'Pending') as 'Passed' | 'Pending' | 'Rejected',
      vatCert: (seller.verificationStatus === 'Verified Merchant' ? 'Passed' : 'Pending') as 'Passed' | 'Pending' | 'Rejected',
      bankDetails: (seller.verificationStatus === 'Verified Merchant' ? 'Passed' : 'Pending') as 'Passed' | 'Pending' | 'Rejected'
    },
    submittedDocuments: [
      { id: 'doc-1', name: 'NBR VAT Trade Registration', status: (seller.verificationStatus === 'Verified Merchant' ? 'Approved' : 'Reviewing') as 'Approved' | 'Rejected' | 'Reviewing', uploadDate: 'June 10, 2026', fileSize: '2.4MB', docType: 'VAT Certification' },
      { id: 'doc-2', name: 'Official Bank Settlement Certificate', status: (seller.verificationStatus === 'Verified Merchant' ? 'Approved' : 'Reviewing') as 'Approved' | 'Rejected' | 'Reviewing', uploadDate: 'June 12, 2026', fileSize: '1.8MB', docType: 'Bank SCB Statement' }
    ],
    reviewHistory: [
      { date: 'June 11, 2026', reviewer: 'Audit Lead Karim', comment: 'All matching registers conform perfectly. Verified authentic ownership of registered brands.' }
    ],
    applicationTimeline: [
      { stage: 'Application Reviewed', date: 'June 10, 2026', status: 'completed' as const },
      { stage: 'Onboarding Approval Granted', date: seller.lastActive, status: 'completed' as const }
    ],
    approvalHistory: [
      { event: 'Approved Onboarded', date: seller.lastActive, note: 'Approved registry stamp.' }
    ]
  };
}

export default function SellerProfile() {
  const { id } = useParams();
  const { profile: loggedInProfile } = useAuth();
  const { triggerPhone, triggerMessage } = useContact();
  const { orders, updateOrderStatus, sendChatMessage } = useOrders();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'brands' | 'commerce' | 'products' | 'orders' | 'reputation' | 'verification' | 'account_settings'>('overview');

  useEffect(() => {
    if (queryTab) {
      const allowedTabs = ['overview', 'brands', 'commerce', 'products', 'orders', 'reputation', 'verification', 'account_settings'];
      if (allowedTabs.includes(queryTab)) {
        setActiveSubTab(queryTab as any);
      }
    }
  }, [queryTab]);

  const handleTabChange = (newTab: any) => {
    setActiveSubTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true });
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);
  const [selectedProfileProduct, setSelectedProfileProduct] = useState<any | null>(null);
  const [selectedProfileOrder, setSelectedProfileOrder] = useState<any | null>(null);
  const [selectedLimitedCustomer, setSelectedLimitedCustomer] = useState<any | null>(null);
  const [productsSearchQuery, setProductsSearchQuery] = useState('');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');

  const isSeller = loggedInProfile?.role === 'seller';
  const isOwnProfile = isSeller;
  const isSuperAdmin = loggedInProfile?.role === 'super_admin';
  const roleDisplay = loggedInProfile?.role === 'super_admin' ? 'Super Administrator' : loggedInProfile?.role === 'seller' ? 'Seller Merchant Owner' : 'Platform Administrator';

  const showToast = (message: string, type: 'success' | 'warn' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const profilesData: Record<string, SellerProfileData> = {
    '4': {
      id: '4',
      name: 'Selina Parvin',
      storeName: 'Meena Bazar Online',
      owner: 'Selina Parvin',
      businessType: 'Private Limited Corporation',
      status: 'Approved',
      verificationStatus: 'Verified Merchant',
      riskStatus: 'Low Risk',
      trustScore: 96,
      trustTrend: 'Improving (+4pts last cycle)',
      sellerTier: 'Platinum Elite Member',
      settlementPlan: 'Weekly Direct Bank Settlement',
      lastActive: 'Today | 2 hr ago',
      email: 'meena.online@fmcg.bd',
      phone: '+880 1611-334455',
      address: 'House 32, Sector 4, Uttara, Dhaka, Bangladesh',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
      category: 'Groceries & FMCG (Approved Brand Owner)',
      registrationDetails: {
        tradeLicense: 'TR-2026-FMCG-9021',
        vatReg: 'VAT-NBR-554488210',
        taxId: 'TIN-4820-1928-8821'
      },
      fulfillmentRate: '98.5%',
      returnRate: '1.2%',
      complaintRate: '0.15%',
      resolutionRate: '100%',
      cancellationRate: '0.23%',
      deliveryPerformance: '98.5% shipped within 24h',
      customerSatisfaction: '4.8/5.0',
      auditScore: '97%',
      operationalHealthBadge: 'Excellent',
      revenue: '৳ 4.8M',
      ordersCount: 2480,
      avgOrderValue: '৳ 1,935',
      repeatPurchaseRate: '34.2%',
      productCount: 248,
      conversionRate: '9.4%',
      growthMetrics: '+14% MoM rate',
      topProducts: [
        { id: 'p-meena-1', name: 'Organic Premium Basmati Rice', price: '৳ 1,200', stock: 154, revenue: '৳ 420K', views: '24.1K clicks', thumbnail: 'https://images.unsplash.com/photo-1597983073492-bc24159b4c03?auto=format&fit=crop&q=80&w=120&h=120', salesCount: 350 },
        { id: 'p-meena-2', name: 'Premium Soyabean Oil 5L', price: '৳ 820', stock: 92, revenue: '৳ 180K', views: '15.4K clicks', thumbnail: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=120&h=120', salesCount: 220 },
        { id: 'p-meena-3', name: 'Pure Mustard Oil 1L', price: '৳ 310', stock: 115, revenue: '৳ 95K', views: '8.1K clicks', thumbnail: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&q=80&w=120&h=120', salesCount: 306 }
      ],
      brandPortfolio: [
        { id: 'brand_meena', name: 'Meena Bazar FMCG', status: 'Approved', trustScore: 96, productCount: 248, revenue: '৳ 4.8M', orderCount: 2480, verificationStatus: 'Verified Official', creationDate: 'Oct 14, 2024' },
        { id: 'brand_meena_fresh', name: 'Meena Organic Fresh', status: 'Approved', trustScore: 94, productCount: 42, revenue: '৳ 850K', orderCount: 310, verificationStatus: 'Verified Official', creationDate: 'Mar 02, 2025' }
      ],
      trustEvents: [
        { id: 't_1', title: 'Audit Passed: Authenticity Guarantee', description: 'Third-party physical audit of Meena Bazar Uttara warehouse verified 100% genuine supply chain sources.', badge: 'Positive', timestamp: 'May 28, 2026' },
        { id: 't_2', title: 'Operational Milestone reached', description: 'Maintained shipping SLA of <24h hours for 3 consecutive months on 1,500+ shipments.', badge: 'Positive', timestamp: 'Apr 11, 2026' },
        { id: 't_3', title: 'Customer Conflict Resolved', description: 'Resolved consumer query ORD-8812 relating to item replacement within 3 hours.', badge: 'Positive', timestamp: 'Feb 19, 2026' }
      ],
      reputationHistory: [
        { id: 'r_1', author: 'Nusrat Jahan', score: 5, comment: 'Incredibly fresh organic staples and immediate shipping. Highly recommended official brand.', time: '2d ago' },
        { id: 'r_2', author: 'Mahmudul Hasan', score: 4.8, comment: 'Very professional, well packed items. Recommended grocery hub on Choosify.', time: '1w ago' }
      ],
      riskAlerts: [
        { level: 'Low', description: 'None active. Operational parameters well within compliance levels.', date: 'May 30, 2026' }
      ],
      fraudFlags: '0 active reports (Strictly Monitored)',
      policyViolations: '0 Minor / 0 Critical Violations',
      recentActivities: [
        { title: 'New Product Batch Uploaded (42 items)', subtitle: 'Friday, Jun 12, 2026 | 11:24am', iconType: 'order' },
        { title: 'Corporate Trade License update submitted', subtitle: 'Thursday, Jun 11, 2026 | 02:15pm', iconType: 'document' },
        { title: 'Reputation Score recalculation passed', subtitle: 'Tuesday, Jun 09, 2026 | 09:30pm', iconType: 'rating' }
      ],
      verificationStatusText: 'Fully Approved (Platform Partner)',
      checklist: {
        identity: 'Passed',
        tradeLicense: 'Passed',
        vatCert: 'Passed',
        bankDetails: 'Passed'
      },
      submittedDocuments: [
        { id: 'doc_1', name: 'Official Trade License Registered 2026', uploadDate: 'May 14, 2026', fileSize: '4.2 MB', docType: 'Trade License', status: 'Approved' },
        { id: 'doc_2', name: 'NBR VAT Certificate (15% rate)', uploadDate: 'May 14, 2026', fileSize: '1.8 MB', docType: 'VAT Certificate', status: 'Approved' },
        { id: 'doc_3', name: 'Verified Bank Settlement Letter (Standard Chartered)', uploadDate: 'May 15, 2026', fileSize: '2.5 MB', docType: 'Bank Letter', status: 'Approved' }
      ],
      reviewHistory: [
        { date: 'May 16, 2026 | 04:20 PM', reviewer: 'Lead Auditor Kabir', comment: 'All documentation authenticated against government registry databases. Passed.' }
      ],
      applicationTimeline: [
        { stage: 'Application Registered', date: 'May 14, 2026', status: 'completed' },
        { stage: 'Document Validation', date: 'May 15, 2026', status: 'completed' },
        { stage: 'Risk Assessment Audit', date: 'May 16, 2026', status: 'completed' },
        { stage: 'Partnership Onboarded', date: 'May 18, 2026', status: 'completed' }
      ],
      approvalHistory: [
        { event: 'Merchant Certified Tier Standard', date: 'May 18, 2026', note: 'Certified by Super Admin Salim' }
      ]
    },
    '2': {
      id: '2',
      name: 'Nadia Akter',
      storeName: 'Nadia Akter Fashion House',
      owner: 'Nadia Akter',
      businessType: 'Sole Proprietorship',
      status: 'Approved',
      verificationStatus: 'Verified Merchant',
      riskStatus: 'Low Risk',
      trustScore: 92,
      trustTrend: 'Stable (Consistent rating)',
      sellerTier: 'Gold Partner Retailer',
      settlementPlan: 'Priority Fast-track Settlement',
      lastActive: 'Within 24 hours',
      email: 'nadia.akter@choosify.com',
      phone: '+222 01 414 8447',
      address: '4140 Parker Rd. Allentown, New Mexico 31134',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
      category: 'Core Merchant / Fashion (Approved Private Seller)',
      registrationDetails: {
        tradeLicense: 'TR-2026-FASH-1024',
        vatReg: 'VAT-NBR-882211904',
        taxId: 'TIN-1120-4492-9921'
      },
      fulfillmentRate: '99.1%',
      returnRate: '0.8%',
      complaintRate: '0.10%',
      resolutionRate: '98%',
      cancellationRate: '0.45%',
      deliveryPerformance: '99.1% shipped within 48h',
      customerSatisfaction: '4.8/5.0',
      auditScore: '94%',
      operationalHealthBadge: 'Excellent',
      revenue: '৳ 14.8M',
      ordersCount: 4821,
      avgOrderValue: '৳ 3,070',
      repeatPurchaseRate: '24.2%',
      productCount: 342,
      conversionRate: '8.2%',
      growthMetrics: '+22% MoM peak',
      topProducts: [
        { id: 'p-nadia-1', name: 'Jamdani Silk Traditional Saree', price: '৳ 14,500', stock: 45, revenue: '৳ 2.4M', views: '12.4K clicks', thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=120&h=120', salesCount: 165 },
        { id: 'p-nadia-2', name: 'Cotton Premium Kurti Set', price: '৳ 3,200', stock: 88, revenue: '৳ 1.8M', views: '8.2K clicks', thumbnail: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&q=80&w=120&h=120', salesCount: 562 }
      ],
      brandPortfolio: [
        { id: 'brand_nadia_fashion', name: 'Nadia Traditional Fashion', status: 'Approved', trustScore: 92, productCount: 342, revenue: '৳ 14.8M', orderCount: 4821, verificationStatus: 'Verified Official', creationDate: 'May 10, 2024' }
      ],
      trustEvents: [
        { id: 't_1', title: 'Audit Passed: Authenticity Guarantee', description: 'Certified pure Jamdani and handcrafted thread work.', badge: 'Positive', timestamp: 'May 10, 2026' }
      ],
      reputationHistory: [
        { id: 'r_1', author: 'Nusrat Jahan', score: 5, comment: 'Incredibly beautiful authentic Jamdani saree.', time: '3w ago' }
      ],
      riskAlerts: [
        { level: 'Low', description: 'None. Parameters healthy.', date: 'May 19, 2026' }
      ],
      fraudFlags: '0 active reports',
      policyViolations: '0 Violations',
      recentActivities: [
        { title: 'New Product Batch Uploaded (12 items)', subtitle: 'Friday, Jun 12, 2026 | 08:24am', iconType: 'order' }
      ],
      verificationStatusText: 'Fully Approved (Retail Merchant Partner)',
      checklist: {
        identity: 'Passed',
        tradeLicense: 'Passed',
        vatCert: 'Passed',
        bankDetails: 'Passed'
      },
      submittedDocuments: [
        { id: 'doc_1', name: 'Sole Proprietor Trade License Registered', uploadDate: 'May 10, 2026', fileSize: '2.8 MB', docType: 'Trade License', status: 'Approved' }
      ],
      reviewHistory: [
        { date: 'May 11, 2026 | 11:30 AM', reviewer: 'Lead Auditor Kabir', comment: 'Proprietorship documents verified. Tax cert OK.' }
      ],
      applicationTimeline: [
        { stage: 'Application Registered', date: 'May 10, 2026', status: 'completed' },
        { stage: 'Partnership Onboarded', date: 'May 12, 2026', status: 'completed' }
      ],
      approvalHistory: [
        { event: 'Merchant Certified', date: 'May 12, 2026', note: 'Approved by Salim' }
      ]
    }
  };

  // Local states for interactivity and route coordination
  const [seller, setSeller] = useState<SellerProfileData>(getDynamicProfile(id || '1'));

  // Editable Profile Form states
  const [profileName, setProfileName] = useState(seller.name);
  const [profileEmail, setProfileEmail] = useState(seller.email);
  const [profilePhone, setProfilePhone] = useState(seller.phone);
  const [profileAddress, setProfileAddress] = useState(seller.address);
  const [profileAvatar, setProfileAvatar] = useState(seller.avatarUrl);

  // Communication Preferences
  const [prefNotifications, setPrefNotifications] = useState(true);
  const [prefEmailAlerts, setPrefEmailAlerts] = useState(true);
  const [prefContactMethod, setPrefContactMethod] = useState<'Email' | 'Phone'>('Email');

  // Security Toggles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginSecurityLock, setLoginSecurityLock] = useState(true);
  const [passwordOld, setPasswordOld] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [inputNote, setInputNote] = useState('');
  const [adminNotesList, setAdminNotesList] = useState<string[]>([
    "Representative is fully authenticated. Official SCB Letter matched matching NID.",
    "No risk parameters triggered on secondary background audit."
  ]);

  // States for verification manual toggles
  const [checklistState, setChecklistState] = useState(seller.checklist);
  
  // Selected brand state for detail view drill-down
  const [selectedBrand, setSelectedBrand] = useState<BrandItem | null>(null);

  useEffect(() => {
    const updatedProfile = getDynamicProfile(id || '1');
    setSeller(updatedProfile);
    setChecklistState(updatedProfile.checklist);
    setSelectedBrand(null);
    setProfileName(updatedProfile.name);
    setProfileEmail(updatedProfile.email);
    setProfilePhone(updatedProfile.phone);
    setProfileAddress(updatedProfile.address);
    setProfileAvatar(updatedProfile.avatarUrl);
  }, [id]);

  const handleToggleChecklist = (field: keyof typeof checklistState, status: 'Passed' | 'Pending' | 'Rejected') => {
    const updated = { ...checklistState, [field]: status };
    setChecklistState(updated);
    showToast(`✓ Verification Checklist [${String(field)}] marked as [${status}]`, 'success');
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNote.trim()) return;
    setAdminNotesList([inputNote.trim(), ...adminNotesList]);
    setInputNote('');
    showToast('✓ Admin operational log notes committed and saved.', 'success');
  };

  // State modifiers - LIMITED TO SUPER ADMINS
  const handleModifyStatus = (newStatus: 'Approved' | 'Suspended' | 'Pending') => {
    if (!isSuperAdmin) {
      showToast('🔒 Access Denied: Only Super Admin can modify Seller Registry Status.', 'warn');
      return;
    }
    setSeller(prev => ({ ...prev, status: newStatus }));
    showToast(`✓ Seller active status updated to [${newStatus}] successfully!`, 'success');
  };

  const handleModifyTrustScore = (amount: number) => {
    if (!isSuperAdmin) {
      showToast('🔒 Access Denied: Only Super Admin can modify base Trust Engine configurations.', 'warn');
      return;
    }
    const newScore = Math.min(100, Math.max(0, seller.trustScore + amount));
    setSeller(prev => ({ ...prev, trustScore: newScore }));
    showToast(`⚙️ Trust Score re-calibrated dynamically to [${newScore}/100].`, 'success');
  };

  const handleBrandStatusToggle = (brandId: string) => {
    if (!isSuperAdmin) {
      showToast('🔒 Access Denied: Only Super Admin can modify Brand active statuses.', 'warn');
      return;
    }
    setSeller(prev => {
      const updatedPortfolio = prev.brandPortfolio.map(b => {
        if (b.id === brandId) {
          const newStatus = b.status === 'Suspended' ? 'Active' : 'Suspended';
          showToast(`✓ Brand status updated to [${newStatus}]`, 'success');
          return { ...b, status: newStatus };
        }
        return b;
      });
      return { ...prev, brandPortfolio: updatedPortfolio };
    });
    setSelectedBrand(prev => {
      if (prev && prev.id === brandId) {
        return { ...prev, status: prev.status === 'Suspended' ? 'Active' : 'Suspended' };
      }
      return prev;
    });
  };

  const handleEditBrandInfo = (brandId: string) => {
    const newName = prompt("Enter new brand name:", selectedBrand?.name || "");
    if (newName === null) return;
    if (!newName.trim()) {
      showToast("⚠️ Brand name cannot be empty.", "warn");
      return;
    }
    setSeller(prev => {
      const updatedPortfolio = prev.brandPortfolio.map(b => {
        if (b.id === brandId) {
          return { ...b, name: newName.trim() };
        }
        return b;
      });
      return { ...prev, brandPortfolio: updatedPortfolio };
    });
    setSelectedBrand(prev => prev ? { ...prev, name: newName.trim() } : null);
    showToast("✓ Brand name updated successfully.", "success");
  };

  const handleDeleteBrand = (brandId: string) => {
    if (!confirm("Are you sure you want to delete this brand from the seller portfolio?")) return;
    setSeller(prev => ({
      ...prev,
      brandPortfolio: prev.brandPortfolio.filter(b => b.id !== brandId)
    }));
    setSelectedBrand(null);
    showToast("✓ Brand deleted successfully from portfolio.", "success");
  };

  const [brandTimeframe, setBrandTimeframe] = useState<'7D' | '30D' | '90D'>('30D');

  const getBrandChartData = (brandScore: number, timeframe: '7D' | '30D' | '90D') => {
    const dataPoints = timeframe === '7D' ? 7 : timeframe === '30D' ? 10 : 12;
    const labels = timeframe === '7D' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : 
                   timeframe === '30D' ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'] : 
                   ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return labels.map((label, i) => {
      const multiplier = (brandScore / 100);
      return {
        name: label,
        impressions: Math.floor((12000 + i * 1400) * multiplier * (1 + Math.sin(i * 0.5) * 0.15)),
        clicks: Math.floor((1400 + i * 220) * multiplier * (1 + Math.cos(i * 0.5) * 0.1)),
        conversion: Number((2.0 + multiplier * 1.5 + Math.sin(i) * 0.3).toFixed(1))
      };
    });
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 shadow-2xl px-5 py-3 rounded-xl border transition-all transform animate-slide-in ${
          toast.type === 'warn' 
            ? 'bg-red-950/90 border-red-500 text-red-200' 
            : 'bg-slate-900/95 border-emerald-500 text-emerald-200'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'warn' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-xs font-bold font-mono uppercase tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <Link to="/admin/dashboard" className="hover:text-app-accent transition-colors">Dashboard</Link>
            {!isSeller && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
                <Link to="/admin/sellers" className="hover:text-app-accent transition-colors">Sellers</Link>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">
              {isSeller ? 'My Business Profile' : seller.storeName}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Seller Intelligence Center</h1>
            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-green-400 px-2 py-0.5 rounded-full font-black tracking-widest uppercase">
              Operational Unit
            </span>
            <span className="text-[10px] bg-white/5 text-slate-400 px-2.5 py-0.5 rounded font-mono">
              Role: {roleDisplay}
            </span>
          </div>
          <p className="text-app-text-secondary text-[12px]">Complete 360-degree regulatory oversight, brand portfolio metrics, dynamic audits, and automated background safety intelligence.</p>
        </div>

        {/* Action Controls */}
        {!isSeller && (
          <div className="flex items-center gap-3">
            <Link 
              to="/admin/sellers"
              className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-xl text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-app-accent" />
              <span>Go Back to List</span>
            </Link>
          </div>
        )}
      </div>

      {/* SECTION A — OVERVIEW HEADER CARD */}
      <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="h-32 bg-gradient-to-r from-[#F4631E]/20 via-slate-900 to-slate-950 relative overflow-hidden flex items-end">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F4631E_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-[0.25em] select-none text-center max-w-full truncate">SELLER</span>
          </div>
          <div className="p-6 w-full flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white pt-12 relative z-10">
            <div className="flex items-center gap-5">
              <img 
                src={seller.avatarUrl} 
                alt={seller.name} 
                className="w-20 h-20 rounded-2xl border-2 border-app-border object-cover shrink-0 shadow-2xl bg-slate-950"
              />
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-white tracking-tight">{seller.storeName}</h2>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                    seller.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    Status: {seller.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {seller.sellerTier}
                  </span>
                </div>
                <p className="text-[11px] text-app-text-secondary mt-1">
                  Entity Owner: <strong className="text-white">{seller.owner}</strong> • Primary Category: <strong className="text-white">{seller.category}</strong>
                </p>
              </div>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <div className="text-center px-4 py-1 border-r border-white/5">
                <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest block block">Trust Score</span>
                <span className="text-base font-black text-emerald-400 font-mono">{seller.trustScore}/100</span>
              </div>
              <div className="text-center px-4 py-1">
                <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest block">Risk Status</span>
                <span className="text-xs font-black text-white uppercase block mt-0.5">{seller.riskStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION A GRID - REGISTRATION AND METADATA */}
        <div className="p-6 bg-app-card border-t border-app-border grid grid-cols-1 md:grid-cols-4 gap-y-6 gap-x-8 text-xs">
          <div>
            <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Legal Business Type</span>
            <span className="text-sm font-semibold text-white mt-1 block">{seller.businessType}</span>
          </div>
          <div>
            <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Settlement Strategy</span>
            <span className="text-sm font-semibold text-[#F4631E] mt-1 block">{seller.settlementPlan}</span>
          </div>
          <div>
            <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Registrations / Government ID</span>
            <div className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
              <p>Trade License: <strong>{seller.registrationDetails.tradeLicense}</strong></p>
              <p>VAT Reg: <strong>{seller.registrationDetails.vatReg}</strong></p>
              <p>Corporate TIN: <strong>{seller.registrationDetails.taxId}</strong></p>
            </div>
          </div>
          <div>
            <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Contact Information</span>
            <div className="mt-1 space-y-0.5 text-slate-300">
              <p className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-500" /> {seller.email}</p>
              <p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-500" /> {seller.phone}</p>
              <p className="flex items-center gap-1 font-semibold text-[10.5px] text-[#F4631E]"><Clock className="w-3.5 h-3.5" /> Last Active: {seller.lastActive}</p>
            </div>
          </div>
          <div className="md:col-span-4 pt-4 border-t border-white/[0.03]">
            <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Business / Warehousing Address</span>
            <span className="text-xs text-white font-medium mt-1 block">{seller.address}</span>
          </div>
        </div>
      </div>

      {/* IN-PAGE MULTI-TAB CONTROLLERS */}
      <div className="flex border-b border-app-border overflow-x-auto scrollbar-hide gap-1 bg-app-card rounded-xl p-1 border">
        {[
          { id: 'overview', label: '📊 Profile SLA & Health', icon: Sliders },
          { id: 'brands', label: '🏬 Brand Portfolio', icon: ShoppingBag },
          { id: 'commerce', label: '📈 Commerce Statistics', icon: TrendingUp },
          { id: 'products', label: '📦 Seller Products', icon: Package },
          ...(!isOwnProfile ? [{ id: 'orders', label: '🛒 Seller Orders', icon: FileText }] : []),
          { id: 'reputation', label: '🛡️ Trust Ledger', icon: ShieldCheck },
          { id: 'verification', label: '🧾 Verification Center', icon: FileCheck },
          ...(isOwnProfile ? [{ id: 'account_settings', label: '⚙️ Account Settings', icon: Settings }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg text-[10px] font-extrabold uppercase tracking-widest cursor-pointer transition-all shrink-0 ${
              activeSubTab === tab.id 
                ? 'bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SUB-TAB CONTENTS */}
      <div className="grid grid-cols-1 gap-6">

        {/* TAB 1: OVERVIEW & SECTION C OPERATIONAL HEALTH */}
        {activeSubTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SLA Ratios */}
            <div className="lg:col-span-2 bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-6">
              <div className="border-b border-white/[0.04] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">SECTION C — SLA Operational Ratios</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Live customer fulfillment timelines, defect ratings, and cancellation statistics.</p>
                </div>
                <span className="px-3 py-1 bg-green-500/10 text-emerald-400 text-[10px] font-bold rounded border border-green-500/20">
                  HEALTH LEVEL: {seller.operationalHealthBadge.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Fulfillment Rate', value: seller.fulfillmentRate, desc: 'Target: >95%', color: 'text-emerald-400' },
                  { label: 'Direct Return Rate', value: seller.returnRate, desc: 'Industry Average: 2.2%', color: 'text-amber-500' },
                  { label: 'Cancellation Defect', value: seller.cancellationRate, desc: 'SLA Limit: <1.50%', color: 'text-emerald-400' },
                  { label: 'Customer Complaints', value: seller.complaintRate, desc: 'Monthly volume', color: 'text-amber-500' },
                  { label: 'Conflict Resolutions', value: seller.resolutionRate, desc: 'Cleared in 24h', color: 'text-emerald-400' },
                  { label: 'Warehouse Audit', value: seller.auditScore, desc: 'Government verified', color: 'text-emerald-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-app-bg/50 border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-[#8E9BAE] uppercase font-bold tracking-wider block">{stat.label}</span>
                    <span className={`text-xl font-bold block ${stat.color}`}>{stat.value}</span>
                    <span className="text-[9px] text-app-text-secondary block font-medium font-mono">{stat.desc}</span>
                  </div>
                ))}
              </div>

              {/* Progress visualizer */}
              <div className="pt-4 border-t border-white/[0.03] space-y-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Unified Transport & Delivery Dispatch Score</span>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-white flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-app-accent-light" /> {seller.deliveryPerformance}</span>
                  <span className="text-emerald-400">97.8% Efficiency</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-500 to-emerald-400 h-full w-[95%]" />
                </div>
              </div>
            </div>

            {/* Quick Actions & Contact card */}
            <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-white/[0.04] pb-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-app-accent" />
                    Operational Contact
                  </h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Direct support routing line.</p>
                </div>
                <div className="text-xs space-y-2 text-slate-300">
                  <p>Officer Registered: <strong className="text-white">{seller.owner}</strong></p>
                  <p>Primary Store Phone: <strong className="text-white">{seller.phone}</strong></p>
                  <p>Email Mailbox: <strong className="text-white font-mono">{seller.email}</strong></p>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/[0.04]">
                <span className="text-[10px] text-[#8E9BAE] uppercase font-bold tracking-widest block opacity-50">Instant Contact Integrations</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => triggerPhone({ id: seller.id, name: seller.name, avatarUrl: seller.avatarUrl, phone: seller.phone, status: seller.status, role: 'Seller' })}
                    className="py-2.5 bg-white/5 border border-app-border hover:border-app-accent text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-[#F4631E]" />
                    <span>Call Store</span>
                  </button>
                  <button
                    onClick={() => triggerMessage({ id: seller.id, name: seller.name, avatarUrl: seller.avatarUrl, phone: seller.phone, status: seller.status, role: 'Seller' })}
                    className="py-2.5 bg-[#F4631E] hover:bg-[#F4631E]/80 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#F4631E]/10"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat Box</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: SECTION B BRAND PORTFOLIO */}
        {activeSubTab === 'brands' && (
          selectedBrand ? (
            /* BRAND INTEL DRILL-DOWN CONTAINER */
            <div className="space-y-6 transition-all duration-300 animate-in fade-in">
               {/* Click to go back */}
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setSelectedBrand(null)}
                   className="flex items-center gap-1.5 px-3.5 py-2 border border-app-border rounded-xl text-xs font-bold text-slate-300 bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm cursor-pointer"
                 >
                   <ArrowLeft className="w-4 h-4 text-app-accent" />
                   <span>Back to Brand Portfolio</span>
                 </button>
                 <span className="text-xs text-slate-500">/</span>
                 <span className="text-xs font-mono text-app-accent-light">{selectedBrand.name} Intelligence Intel</span>
               </div>

               {/* MODULE 1: BRAND HEADER SECTION */}
               <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-6">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.04] pb-6">
                   <div className="flex items-center gap-5">
                     <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#F4631E] to-amber-500 flex items-center justify-center text-white text-xl font-bold shadow-2xl border border-white/10 shrink-0 uppercase">
                       {selectedBrand.name ? selectedBrand.name.substring(0, 2) : 'B'}
                     </div>
                     <div>
                       <div className="flex items-center gap-3 flex-wrap">
                         <h2 className="text-xl font-black text-white tracking-tight">{selectedBrand.name}</h2>
                         
                         {/* Status Badge */}
                         <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-widest border ${
                           selectedBrand.status === 'Verified' || selectedBrand.status === 'Approved'
                             ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                             : selectedBrand.status === 'Active'
                             ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                             : 'bg-red-500/10 text-red-500 border-red-500/20'
                         }`}>
                           {selectedBrand.status}
                         </span>

                         {/* category tags */}
                         <span className="bg-white/5 border border-white/10 text-slate-300 px-2.5 py-0.5 rounded text-[10px] font-semibold">
                           {selectedBrand.category}
                         </span>
                       </div>
                       <p className="text-app-text-secondary text-xs mt-1.5">{selectedBrand.shortDescription}</p>
                     </div>
                   </div>

                   {/* Quick actions inside detail context */}
                   <div className="flex flex-wrap gap-2 shrink-0">
                     <button 
                       onClick={() => handleBrandStatusToggle(selectedBrand.id)}
                       className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                         selectedBrand.status === 'Suspended'
                           ? 'bg-green-500 text-white border-transparent hover:bg-green-600'
                           : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-red-500 hover:text-white'
                       }`}
                     >
                       <Ban className="w-3.5 h-3.5" />
                       {selectedBrand.status === 'Suspended' ? 'Activate Brand' : 'Deactivate Brand'}
                     </button>
                     <button 
                       onClick={() => handleEditBrandInfo(selectedBrand.id)}
                       className="flex items-center gap-1.5 px-4 py-2 bg-app-card border border-app-border text-white rounded-xl text-xs font-bold hover:bg-white/5 hover:border-app-accent transition-all cursor-pointer"
                     >
                       <Edit3 className="w-3.5 h-3.5 text-app-accent" />
                       <span>Edit Info</span>
                     </button>
                     <button 
                       onClick={() => handleDeleteBrand(selectedBrand.id)}
                       className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                       <span>Delete Brand</span>
                     </button>
                   </div>
                 </div>

                 {/* MODULE 2: KEY PERFORMANCE METRICS */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   {[
                     { label: 'Followers Growth', val: selectedBrand.followers, icon: Users, trend: selectedBrand.followersTrend, color: 'text-blue-400' },
                     { label: 'Live Products', val: `${selectedBrand.productCount} SKUs`, icon: Package, trend: selectedBrand.productsTrend, color: 'text-orange-400' },
                     { label: 'Average Rating', val: `⭐ ${selectedBrand.rating}/5.0`, icon: Star, trend: selectedBrand.ratingTrend, color: 'text-yellow-400' },
                     { label: 'Conversion Rate', val: selectedBrand.conversionRate, icon: TrendingUp, trend: selectedBrand.conversionTrend, color: 'text-emerald-400' }
                   ].map((stat, i) => (
                     <div key={i} className="bg-app-bg border border-app-border rounded-xl p-4 flex justify-between items-start shadow-inner">
                       <div className="space-y-1">
                         <span className="text-[10px] text-app-text-secondary uppercase font-bold tracking-wider block opacity-70">{stat.label}</span>
                         <span className="text-xl font-extrabold text-white tracking-tight block font-mono">{stat.val}</span>
                         <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                           {stat.trend} MoM
                         </span>
                       </div>
                       <stat.icon className={`w-5 h-5 ${stat.color} opacity-80`} />
                     </div>
                   ))}
                 </div>

                 {/* TWO COLUMN GRID FOR DETAILED DATA & ANALYTICS */}
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   
                   {/* COLUMN 1: BRAND PROFILE DATA */}
                   <div className="bg-app-bg border border-app-border rounded-2xl p-5 space-y-6">
                     <div>
                       <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E] mb-4">MODULE 3 — Profile & Registry</h4>
                       <div className="divide-y divide-white/5 space-y-3.5 text-xs">
                         <div className="flex justify-between items-center py-2">
                           <span className="text-app-text-secondary font-medium">Legal Entity ID</span>
                           <span className="text-white font-mono font-bold uppercase">{selectedBrand.legalEntityId}</span>
                         </div>
                         <div className="flex justify-between items-center py-2 pt-3">
                           <span className="text-app-text-secondary font-medium">Primary Category</span>
                           <span className="text-white font-semibold text-right">{selectedBrand.category}</span>
                         </div>
                         <div className="flex justify-between items-center py-2 pt-3">
                           <span className="text-app-text-secondary font-medium">Origin / Country</span>
                           <span className="text-white font-semibold">{selectedBrand.originCountry}</span>
                         </div>
                         <div className="flex justify-between items-center py-2 pt-3">
                           <span className="text-app-text-secondary font-medium">Onboarded Since</span>
                           <span className="text-slate-300 font-mono font-semibold">{selectedBrand.onboardedSince}</span>
                         </div>
                         <div className="flex justify-between items-center py-2 pt-3">
                           <span className="text-app-text-secondary font-medium">Ownership Info</span>
                           <span className="text-slate-300 text-right">{selectedBrand.ownershipInfo}</span>
                         </div>
                         <div className="flex justify-between items-center py-2 pt-3 border-b border-white/5">
                           <span className="text-app-text-secondary font-medium">Seller Status Tier</span>
                           <span className="text-emerald-400 font-bold uppercase">{selectedBrand.sellerTier}</span>
                         </div>
                       </div>
                     </div>
                     
                     {/* MODULE 8: OPERATIONS & LOGISTICS */}
                     <div className="pt-2 border-t border-white/[0.04] space-y-4">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E]">MODULE 8 — Operations & Logistics</h4>
                       <div className="space-y-3 text-xs">
                         <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-1">
                           <span className="text-[10px] text-slate-400 font-medium block">Primary Warehouse Distribution Node</span>
                           <span className="text-white font-bold block">{selectedBrand.primaryWarehouse}</span>
                         </div>
                         <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-1">
                           <span className="text-[10px] text-slate-400 font-medium block">Fulfillment Integration Mode</span>
                           <span className="text-app-accent-light font-bold block">{selectedBrand.fulfillmentMode}</span>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                             <span className="text-[9px] text-slate-400 block uppercase font-bold">Delivery Status</span>
                             <span className="text-emerald-400 font-bold text-[10.5px] block mt-0.5">{selectedBrand.deliveryStatus}</span>
                           </div>
                           <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                             <span className="text-[9px] text-slate-400 block uppercase font-bold">Active Campaigns</span>
                             <span className="text-[#F4631E] font-bold text-[10px] block mt-0.5 truncate" title={selectedBrand.activeCampaigns}>{selectedBrand.activeCampaigns}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>

                   {/* COLUMN 2: ANALYTICS & RECHART PLOTS */}
                   <div className="lg:col-span-2 bg-app-bg border border-app-border rounded-2xl p-5 space-y-5">
                     <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                       <div>
                         <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E]">MODULE 4 — Performance Analytics</h4>
                         <p className="text-[10px] text-slate-400 mt-1">Unified traffic, click logs, and verified checkout conversions.</p>
                       </div>
                       
                       {/* Time limits selector */}
                       <div className="flex bg-white/5 max-w-fit rounded-lg p-0.5 border border-white/5">
                         {(['7D', '30D', '90D'] as const).map(tf => (
                           <button
                             key={tf}
                             onClick={() => setBrandTimeframe(tf)}
                             className={`px-3 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                               brandTimeframe === tf 
                                 ? 'bg-[#F4631E] text-white' 
                                 : 'text-slate-400 hover:text-white'
                             }`}
                           >
                             {tf}
                           </button>
                         ))}
                       </div>
                     </div>

                     {/* Rechart rendering engine */}
                     <div className="h-64 mt-2">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={getBrandChartData(selectedBrand.trustScore, brandTimeframe)}>
                           <defs>
                             <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#F4631E" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#F4631E" stopOpacity={0}/>
                             </linearGradient>
                             <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                               <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                           <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontFamily="monospace" />
                           <YAxis stroke="#94a3b8" fontSize={9} fontFamily="monospace" />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#131e35', borderColor: '#1e293b', borderRadius: '8px' }}
                             labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold' }}
                           />
                           <Area type="monotone" dataKey="impressions" stroke="#F4631E" strokeWidth={2} fillOpacity={1} fill="url(#colorImpressions)" name="Views" />
                           <Area type="monotone" dataKey="clicks" stroke="#38bdf8" strokeWidth={1.5} fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
                         </AreaChart>
                       </ResponsiveContainer>
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/[0.01] p-3 rounded-lg border border-white/5 text-center text-xs">
                       <div>
                         <span className="text-[10px] text-slate-400 block font-semibold">Total Views</span>
                         <span className="text-white font-bold font-mono">148,291</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-slate-400 block font-semibold">Click count</span>
                         <span className="text-[#38bdf8] font-bold font-mono">14,210</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-slate-400 block font-semibold">Click Through Ratio</span>
                         <span className="text-yellow-400 font-bold font-mono">9.58%</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-slate-400 block font-semibold">Checkout CTR</span>
                         <span className="text-emerald-400 font-bold font-mono">{selectedBrand.conversionRate}</span>
                       </div>
                     </div>
                   </div>

                 </div>

                 {/* TRUST SYSTEM & REPUTATION ONWARDS */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   
                   {/* MODULE 5: TRUST & REPUTATION */}
                   <div className="bg-app-bg border border-app-border rounded-2xl p-6 space-y-6">
                     <div className="border-b border-white/[0.04] pb-3">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E] flex items-center gap-1.5">
                         <ShieldCheck className="w-4 h-4 text-emerald-400" />
                         MODULE 5 — Trust & Reputation Ledger
                       </h4>
                       <p className="text-[10px] text-slate-400 mt-1">Real-time cryptographic audit score and compliance telemetry.</p>
                     </div>

                     <div className="flex flex-col md:flex-row items-center gap-6 justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5">
                       <div className="space-y-1 text-center md:text-left">
                         <span className="text-[10px] uppercase font-bold text-slate-400 block">Unified Trust Rating</span>
                         <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">{selectedBrand.trustScore}/100</span>
                         <span className="text-[9px] uppercase font-extrabold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded block max-w-fit mt-1">A-GRADE SHIELD</span>
                       </div>
                       
                       <div className="flex bg-[#F4631E]/5 max-w-fit p-3.5 rounded-xl border border-[#F4631E]/10 flex-col space-y-1">
                         <span className="text-[10.5px] font-bold text-[#F4631E] block">TRUST EMBED SUPPORT</span>
                         <span className="text-[9.5px] text-slate-400 font-mono block select-all">/api/v1/trust/embed/{selectedBrand.id}</span>
                         <button 
                           onClick={() => {
                             navigator.clipboard.writeText(`<iframe src="https://choosify.bd/api/v1/trust/embed/${selectedBrand.id}" width="350" height="200"></iframe>`);
                             showToast("✓ Trust Widget HTML snippet copied to clipboard!", "success");
                           }}
                           className="text-[10px] text-white bg-slate-800 hover:bg-[#F4631E] hover:text-white px-2 py-1 rounded font-bold cursor-pointer transition-colors max-w-fit flex items-center gap-1 mt-1"
                         >
                           <Copy className="w-3 h-3" />
                           <span>Copy Widget Embed Code</span>
                         </button>
                       </div>
                     </div>

                     <div className="space-y-3.5">
                       <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trust Metrics Breakdown</h5>
                       <div className="space-y-3 text-xs">
                         {[
                           { label: 'Product Authenticity Scale', score: selectedBrand.authenticityRating || '98%' },
                           { label: 'Logistics SLA Compliance Score', score: selectedBrand.logisticsCompliance || '96%' },
                           { label: 'Merchant Complaint Resolution Ratio', score: selectedBrand.complaintResolution || '99%' },
                           { label: 'Creator Impact & Authenticity Score', score: selectedBrand.creatorImpact || '94%' }
                         ].map((m, idx) => (
                           <div key={idx} className="space-y-1">
                             <div className="flex justify-between text-[11px] font-semibold text-slate-300">
                               <span>{m.label}</span>
                               <span className="text-white font-mono">{m.score}</span>
                             </div>
                             <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                               <div 
                                 className="bg-gradient-to-r from-orange-500 to-emerald-400 h-full" 
                                 style={{ width: m.score }}
                               />
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>

                   {/* MODULE 6: TRANSPARENCY TIMELINE LOGS */}
                   <div className="bg-app-bg border border-app-border rounded-2xl p-6 space-y-5">
                     <div className="border-b border-white/[0.04] pb-3">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E] flex items-center gap-1.5">
                         <History className="w-4 h-4 text-orange-400" />
                         MODULE 6 — Transparency Timeline Logs
                       </h4>
                       <p className="text-[10px] text-slate-400 mt-1">Chronological cryptographic verification events of the brand entity.</p>
                     </div>

                     <div className="relative pl-6 border-l border-white/5 text-xs space-y-5">
                       {[
                         { title: 'Dynamic Smart Audits Enabled', desc: 'Enabled real-time integrity and price fluctuation scanners on all catalog product ranges.', date: 'Jun 15, 2026 | 03:30pm UTC', badge: 'Audit Event' },
                         { title: 'Trademark Verification Approved', desc: 'NBR registered ownership documents matched flawlessly. Official trademark clearance verified.', date: 'Jun 15, 2026 | 02:15pm UTC', badge: 'Approval' },
                         { title: 'Authorized Merchant Sync sweep', desc: 'Verified identity of lead officer Rahim Uddin with central database registry.', date: 'Jun 15, 2026 | 11:20am UTC', badge: 'Compliance' },
                         { title: 'Brand Onboarded to Choosify Platform', desc: 'Registered flagship store and connected standard logistics settlement.', date: 'Jun 15, 2026 | 09:43am UTC', badge: 'Onboarding' }
                       ].map((evt, idx) => (
                         <div key={idx} className="relative space-y-1 group">
                           {/* Circle bullet node */}
                           <div className="absolute -left-[30px] top-1 w-2 h-2 rounded-full bg-[#F4631E] border border-slate-900 group-hover:scale-125 transition-transform" />
                           
                           <div className="flex items-center gap-2">
                             <h5 className="font-bold text-white text-[12px]">{evt.title}</h5>
                             <span className="text-[8px] font-black uppercase text-[#F4631E] bg-[#F4631E]/10 px-1.5 py-0.5 rounded font-mono">{evt.badge}</span>
                           </div>
                           <p className="text-[10.5px] text-slate-400 font-medium leading-relaxed">{evt.desc}</p>
                           <span className="text-[9px] text-[#8E9BAE] font-mono block mt-0.5 h-auto">{evt.date}</span>
                         </div>
                       ))}
                     </div>
                   </div>

                 </div>

                 {/* MODULE 7: TOP PRODUCTS SECTION */}
                 <div className="bg-app-bg border border-app-border rounded-xl p-5 space-y-4">
                   <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
                     <div>
                       <h4 className="text-xs font-bold uppercase tracking-widest text-[#F4631E] flex items-center gap-1.5">
                         <Package className="w-4 h-4 text-app-accent-light" />
                         MODULE 7 — Top Performing Brand Catalog Products
                       </h4>
                       <p className="text-[10px] text-slate-400 mt-1">Catalog items driving highest CTR, impressions and checkout volume.</p>
                     </div>
                     <button
                       onClick={() => {
                         setActiveSubTab('commerce');
                         setSelectedBrand(null);
                         showToast("✓ Navigated to Commerce Catalog", "success");
                       }}
                       className="text-[10.5px] font-extrabold text-[#F4631E] uppercase hover:underline flex items-center gap-1 cursor-pointer transition-all"
                     >
                       <span>View All Products in Catalog</span>
                       <ChevronRight className="w-4 h-4" />
                     </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {[
                       { name: `${selectedBrand.name} Premium Elite Edition`, price: '৳ 42,950', rating: 4.9, score: 98, views: '14.2K views', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80' },
                       { name: `${selectedBrand.name} Flagship Signature Classic`, price: '৳ 23,800', rating: 4.8, score: 94, views: '9.8K views', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80' }
                     ].map((prod, i) => (
                       <div key={i} className="flex bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-xl p-3.5 items-center justify-between transition-all">
                         <div className="flex items-center gap-3.5">
                           <img src={prod.image} className="w-12 h-12 rounded-lg object-cover border border-white/10 shadow-lg" alt="" />
                           <div className="space-y-0.5">
                             <h4 className="text-xs font-extrabold text-white">{prod.name}</h4>
                             <p className="text-[11px] text-emerald-400 font-bold font-mono">{prod.price}</p>
                             <div className="flex items-center gap-1 text-[10px] text-slate-400">
                               <span>⭐ {prod.rating} Rating</span>
                               <span>•</span>
                               <span>{prod.views}</span>
                             </div>
                           </div>
                         </div>
                         <div className="text-right shrink-0">
                           <span className="text-[10px] block text-slate-400 font-medium">Performance Score</span>
                           <span className="text-sm font-black text-emerald-400 font-mono">{prod.score}/100</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

               </div>
            </div>
          ) : (
            /* BRAND ENTITY LIST */
            <div className="bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-xl space-y-6">
              <div className="p-6 border-b border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">SECTION B — Approved Brand Portfolio</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Commercial entities owned by this business entity on Choosify. Click any card to drill down.</p>
                </div>
                <span className="text-xs bg-[#F4631E]/10 border border-[#F4631E]/20 text-[#F4631E] px-3.5 py-1 rounded-[4px] font-mono">
                  {seller.brandPortfolio.length} Registered Brands
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {seller.brandPortfolio.map(brand => (
                  <div 
                    key={brand.id} 
                    onClick={() => setSelectedBrand(brand)}
                    className="bg-app-bg border border-app-border rounded-2xl p-5 hover:border-app-accent/45 hover:bg-white/[0.015] transition-all cursor-pointer group flex flex-col justify-between space-y-4 hover:scale-[1.01] duration-200"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#F4631E]/20 to-orange-500/10 border border-orange-500/20 flex items-center justify-center text-sm font-bold shadow-inner uppercase shrink-0 text-[#F4631E]">
                          {brand.name ? brand.name.substring(0, 2) : 'B'}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white group-hover:text-app-accent-light transition-colors">{brand.name}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{brand.category || 'Premium General Goods'}</p>
                        </div>
                      </div>
                      
                      <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-widest border ${
                        brand.status === 'Verified' || brand.status === 'Approved'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : brand.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {brand.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white/[0.01] border border-white/5 p-2 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-[9px] text-[#8D9CAE] block uppercase font-bold tracking-wider">Followers</span>
                        <span className="text-[11.5px] font-bold text-white font-mono mt-0.5 block">{brand.followers || '2,400'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#8D9CAE] block uppercase font-bold tracking-wider">SKU Count</span>
                        <span className="text-[11.5px] font-bold text-white font-mono mt-0.5 block">{brand.productCount} SKUs</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#8D9CAE] block uppercase font-bold tracking-wider">Est. CTR</span>
                        <span className="text-[11.5px] font-bold text-emerald-400 font-mono mt-0.5 block">{brand.conversionRate || '2.4%'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] border-t border-white/[0.04] pt-3 text-slate-400 font-medium">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span>⭐ <strong className="text-white font-mono font-bold">{brand.rating || '4.8'}</strong>/5.0 Rating</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-app-accent group-hover:translate-x-1 transition-transform">
                        <span>View Intel Dashboard</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* TAB 3: SECTION D COMMERCE & PRODUCTS */}
        {activeSubTab === 'commerce' && (
          <div className="space-y-6">
            
            {/* Sales performance panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'SECTION D — Commerce Revenue', val: seller.revenue, icon: TrendingUp, meta: seller.growthMetrics, color: 'text-emerald-400' },
                { label: 'Active Retail Orders', val: `${seller.ordersCount} volume`, icon: ShoppingBag, meta: '99.8% Defect Free', color: 'text-blue-400' },
                { label: 'Average Ticket Value', val: seller.avgOrderValue, icon: Percent, meta: 'Higher than Category Avg', color: 'text-app-accent' },
                { label: 'Subscriber Repeat CTR', val: seller.repeatPurchaseRate, icon: Star, meta: 'High Customer Love', color: 'text-[#F4631E]' }
              ].map((card, idx) => (
                <div key={idx} className="bg-app-card border border-app-border rounded-xl p-5 shadow-xl flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">{card.label}</span>
                    <span className="text-lg font-black text-white tracking-tight block font-mono">{card.val}</span>
                    <span className="text-[10px] text-emerald-400 block font-semibold">{card.meta}</span>
                  </div>
                  <card.icon className="w-5 h-5 text-slate-500 mt-1" />
                </div>
              ))}
            </div>

            {/* List of top selling products */}
            <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
              <div className="border-b border-white/[0.04] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Selling Catalog SKUs</h3>
                  <p className="text-[11px] text-app-text-secondary mt-0.5">Top-performing products categorized by warehouse click and conversions.</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Store Catalog Count: {seller.productCount} SKUs</span>
              </div>

              <div className="space-y-3">
                {seller.topProducts.map(product => (
                  <div key={product.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-xl bg-white/[0.01] border hover:bg-white/[0.02] border-white/5 transition-all">
                    <div className="col-span-1 md:col-span-6 flex items-center gap-3">
                      <img src={product.thumbnail} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-slate-950 border shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{product.name}</h4>
                        <span className="text-[9.5px] text-[#8E9BAE] font-mono">SKU ID: {product.id} | Warehoused Stock: {product.stock} items</span>
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 text-right">
                      <span className="text-[8.5px] md:hidden text-[#8E9BAE] font-bold uppercase block">Retail Value</span>
                      <span className="text-xs font-bold text-white font-mono">{product.price}</span>
                    </div>
                    <div className="col-span-1 md:col-span-2 text-right text-app-accent-light font-bold font-mono">
                      <span className="text-[8.5px] md:hidden text-[#8E9BAE] font-bold uppercase block">SKUs Sold</span>
                      <span>{product.salesCount} sold</span>
                    </div>
                    <div className="col-span-1 md:col-span-2 text-right text-emerald-400 font-bold font-mono">
                      <span className="text-[8.5px] md:hidden text-[#8E9BAE] font-bold uppercase block">Revenue Contribution</span>
                      <span>{product.revenue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3.1: PRODUCTS VIEW LISTINGS & MODERATION */}
        {activeSubTab === 'products' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedProfileProduct ? (
              /* PRODUCT DETAIL WORKSPACE */
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedProfileProduct(null)}
                      className="p-2 border border-app-border hover:border-white rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Product Legacy Detail View</h3>
                      <p className="text-[11px] text-app-text-secondary mt-0.5">Admin moderation clearance panel & full SEO metadata analysis.</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-3 py-1 font-black uppercase rounded ${
                    selectedProfileProduct.status === 'Live' || selectedProfileProduct.status === 'Approved'
                      ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                      : 'bg-red-500/15 text-red-400 border border-red-500/20'
                  }`}>
                    {selectedProfileProduct.status || 'Live'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Photo & Core Card */}
                  <div className="md:col-span-4 space-y-4">
                    <img
                      referrerPolicy="no-referrer"
                      src={selectedProfileProduct.thumbnail}
                      alt={selectedProfileProduct.name}
                      className="w-full aspect-square object-cover rounded-xl border border-app-border bg-slate-950"
                    />
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4 space-y-2">
                      <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-widest block">Product Identifier</span>
                      <span className="text-xs font-mono text-white block mt-0.5 font-bold">SKU-{selectedProfileProduct.id}</span>
                      <span className="text-[9px] text-[#8E9BAE] font-bold uppercase tracking-widest block pt-2">Store Brand Target</span>
                      <span className="text-xs text-white block font-semibold">{seller.storeName}</span>
                    </div>
                  </div>

                  {/* Pricing, description and characteristics */}
                  <div className="md:col-span-8 space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-base font-black text-white tracking-tight leading-snug">{selectedProfileProduct.name}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        This is an official prime certified retail catalog product offered directly by {seller.storeName} with full platform logistics clearance and SLA support.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                        <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Retail Price</span>
                        <span className="text-xs font-bold text-white font-mono mt-1 block">{selectedProfileProduct.price}</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                        <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Warehouse Stock</span>
                        <span className="text-xs font-bold text-white font-mono mt-1 block">{selectedProfileProduct.stock || 45} units</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                        <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Accumulated Sold</span>
                        <span className="text-xs font-bold text-[#F4631E] font-mono mt-1 block">{selectedProfileProduct.salesCount || 120} sold</span>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                        <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Page Clicks</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono mt-1 block">{selectedProfileProduct.views || 450}</span>
                      </div>
                    </div>

                    <div className="border border-[#F4631E]/20 bg-[#F4631E]/5 rounded-xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-[#F4631E]" />
                        <span>Platform Administrator Moderation Desk</span>
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Review product authenticity against registered business vat/trade details. Actions taken immediately update storefront exposure indexes.
                      </p>
                      
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => {
                            selectedProfileProduct.status = 'Approved';
                            showToast('Product Listing approved as Live', 'success');
                            setSelectedProfileProduct({ ...selectedProfileProduct });
                          }}
                          className="px-4 py-2 text-[11px] font-bold bg-green-600 hover:bg-green-500 text-white rounded cursor-pointer transition-colors"
                        >
                          Approve Listing (Go Live)
                        </button>
                        <button
                          onClick={() => {
                            selectedProfileProduct.status = 'Flagged';
                            showToast('Product Listing marked as Flagged & Suspended', 'warn');
                            setSelectedProfileProduct({ ...selectedProfileProduct });
                          }}
                          className="px-4 py-2 text-[11px] font-bold bg-red-600 hover:bg-red-500 text-white rounded cursor-pointer transition-colors"
                        >
                          Flag & Suspend SKU
                        </button>
                        <Link
                          to={`/admin/products`}
                          className="px-4 py-2 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-white border border-app-border rounded cursor-pointer transition-all"
                        >
                          Manage in Advanced Editor
                        </Link>
                        <button
                          onClick={() => {
                            showToast('Catalog item removed successfully from lists.', 'success');
                            setSelectedProfileProduct(null);
                          }}
                          className="px-4 py-2 text-[11px] font-bold bg-black text-rose-500 border border-rose-950 rounded cursor-pointer hover:bg-rose-950/20 transition-all"
                        >
                          Remove Catalog Entry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PRODUCTS LISTING VIEW */
              <div className="space-y-4">
                <div className="bg-app-card border border-app-border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#F4631E]" />
                    <input
                      type="text"
                      placeholder="Search store products, keywords or SKUs..."
                      value={productsSearchQuery}
                      onChange={(e) => setProductsSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white/[0.02] border border-app-border rounded-xl text-xs w-full focus:outline-none focus:border-[#F4631E]/40 text-white placeholder-slate-500 font-medium"
                    />
                  </div>
                  <Link
                    to="/admin/products"
                    className="flex items-center gap-2 bg-[#F4631E] hover:bg-[#F4631E]-light text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 text-center shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Product SKU
                  </Link>
                </div>

                <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="border-b border-white/[0.04] pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Store Product Catalog listings</h3>
                      <p className="text-[11px] text-app-text-secondary mt-0.5">Filter, approve, view, or manage the products linked to this seller.</p>
                    </div>
                    <span className="text-[10px] text-[#8E9BAE] font-mono">Store Catalog: {seller.topProducts.length} items</span>
                  </div>

                  <div className="space-y-3">
                    {seller.topProducts
                      .filter(p => !productsSearchQuery || p.name.toLowerCase().includes(productsSearchQuery.toLowerCase()))
                      .map(product => (
                        <div key={product.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-xl bg-white/[0.01] border hover:bg-white/[0.02] border-white/5 transition-all">
                          <div className="col-span-1 md:col-span-5 flex items-center gap-3">
                            <img src={product.thumbnail} alt={product.name} className="w-11 h-11 rounded-lg object-cover bg-slate-950 border shrink-0" />
                            <div>
                              <h4 className="text-xs font-black text-white">{product.name}</h4>
                              <span className="text-[10px] text-[#8E9BAE] font-mono font-bold">SKU ID: {product.id} | Stock: {product.stock} items</span>
                            </div>
                          </div>
                          <div className="col-span-1 md:col-span-2 text-right">
                            <span className="text-xs font-bold text-white font-mono">{product.price}</span>
                          </div>
                          <div className="col-span-1 md:col-span-2 text-right text-app-accent-light font-bold font-mono text-xs">
                            <span>{product.salesCount} sold</span>
                          </div>
                          <div className="col-span-1 md:col-span-3 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedProfileProduct(product)}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-[10.5px] font-bold border border-app-border cursor-pointer transition-all"
                            >
                              Details
                            </button>
                            <Link
                              to={`/admin/products`}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10.5px] font-bold border border-app-border"
                            >
                              Edit SKU
                            </Link>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3.2: ORDERS VIEW HUB */}
        {activeSubTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {selectedProfileOrder ? (
              /* ORDER DETAIL WORKSHEET & EXPANSION */
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.04] pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedProfileOrder(null)}
                      className="p-2 border border-app-border hover:border-white rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">Order {selectedProfileOrder.id}</h3>
                      <p className="text-[11px] text-app-text-secondary mt-0.5">Complete shipping records, customer notes, invoices and statuses.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Invoice Actions */}
                    <button
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Invoice ${selectedProfileOrder.id}</title>
                                <style>
                                  body { font-family: 'Inter', sans-serif; padding: 40px; color: #111; line-height: 1.5; }
                                  .header { display: flex; justify-content: space-between; border-b: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                                  .logo { font-size: 24px; font-weight: 800; color: #F4631E; }
                                  .title { font-size: 20px; font-weight: 700; text-align: right; }
                                  .details { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                                  .details h4 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
                                  table { w-full; width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                  th, td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; font-size: 13px; }
                                  th { background-color: #f9f9f9; font-weight: 700; }
                                  .total-section { display: flex; justify-content: flex-end; }
                                  .total-box { width: 300px; }
                                  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
                                  .total-row.grand { border-top: 2px solid #111; font-weight: bold; font-size: 16px; padding-top: 12px; }
                                  .footer { text-align: center; border-top: 1px solid #eee; padding-top: 30px; margin-top: 60px; font-size: 11px; color: #777; }
                                  @media print { body { padding: 0; } }
                                </style>
                              </head>
                              <body>
                                <div class="header">
                                  <div>
                                    <div class="logo">CHOOSIFY MERCHANDISING</div>
                                    <div style="font-size: 12px; color: #555; margin-top: 5px;">Official Supply Hub: ${seller.storeName}</div>
                                  </div>
                                  <div class="title">
                                    Official Invoice<br/>
                                    <span style="font-size: 12px; color: #555; font-weight: normal;">ID: INV-${Math.floor(100000 + Math.random() * 900000)}</span><br/>
                                    <span style="font-size: 11px; color: #777; font-weight: normal;">Date: Jun 16, 2026</span>
                                  </div>
                                </div>
                                
                                <div class="details">
                                  <div>
                                    <h4>SUPPLIER STORE</h4>
                                    <strong>${seller.storeName}</strong><br/>
                                    Owner: ${seller.owner}<br/>
                                    Category License: ${seller.category}<br/>
                                    Trade License: ${seller.registrationDetails?.tradeLicense || 'TR-PRO-8812'}
                                  </div>
                                  <div>
                                    <h4>SHIPPED TO</h4>
                                    <strong>${selectedProfileOrder.customer.name}</strong><br/>
                                    Email: ${selectedProfileOrder.customer.email}<br/>
                                    Address: ${selectedProfileOrder.customer.address || 'House 14, Road 4, Sector 12, Uttara, Dhaka'}<br/>
                                    Phone: ${selectedProfileOrder.customer.phone || '+880 1711-456789'}
                                  </div>
                                </div>
                                
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Item Description</th>
                                      <th>SKU / Product ID</th>
                                      <th>Qty</th>
                                      <th style="text-align: right;">Unit Price</th>
                                      <th style="text-align: right;">Total Line</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td>${selectedProfileOrder.product.name}</td>
                                      <td>SKU-${selectedProfileOrder.product.id}</td>
                                      <td>1</td>
                                      <td style="text-align: right;">৳ ${selectedProfileOrder.product.price.toLocaleString()}</td>
                                      <td style="text-align: right;">৳ ${selectedProfileOrder.product.price.toLocaleString()}</td>
                                    </tr>
                                  </tbody>
                                </table>
                                
                                <div class="total-section">
                                  <div class="total-box">
                                    <div class="total-row"><span>Product Subtotal:</span><span>৳ ${selectedProfileOrder.product.price.toLocaleString()}</span></div>
                                    <div class="total-row"><span>Logistics Shipping:</span><span>৳ 120</span></div>
                                    <div class="total-row"><span>Advance Paid:</span><span>৳ 0</span></div>
                                    <div class="total-row grand"><span>Gross COD Payable:</span><span>৳ ${(selectedProfileOrder.product.price + 120).toLocaleString()}</span></div>
                                  </div>
                                </div>
                                
                                <div class="footer">
                                  Thank you for buying from ${seller.storeName} via Choosify Commerce Network.<br/>
                                  For complaints or help, contact support@choosify.com. All systems logged.
                                </div>
                                <script>window.print();</script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        } else {
                          showToast('Browser blocked pop-up! Allow Popups to print Invoice.', 'warn');
                        }
                      }}
                      className="px-3.5 py-2 bg-[#F4631E] hover:bg-[#F4631E]/90 text-white rounded text-xs font-black cursor-pointer shadow-lg transition-all"
                    >
                      Print Official Invoice
                    </button>
                    
                    <span className={`text-[10px] px-3 py-1 font-black uppercase rounded ${
                      selectedProfileOrder.status === 'Delivered'
                        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                        : selectedProfileOrder.status === 'Cancelled'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                    }`}>
                      {selectedProfileOrder.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left part: 4 expanded detail boxes */}
                  <div className="md:col-span-8 space-y-6">
                    
                    {/* 1. CUSTOMER INFORMATION */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-3.5">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#F4631E]" />
                        <span>1. Customer Identity & Delivery Parameters</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Customer Name</span>
                          <button
                            onClick={() => setSelectedLimitedCustomer({ ...selectedProfileOrder.customer, phone: selectedProfileOrder.customer.phone || '+880 1611-334455' })}
                            className="text-white hover:text-[#F4631E] font-bold mt-1 text-left block underline decoration-dotted cursor-pointer transition-colors"
                          >
                            {selectedProfileOrder.customer.name}
                          </button>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Customer Email</span>
                          <span className="text-white font-semibold mt-1 block">{selectedProfileOrder.customer.email}</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Phone contact</span>
                          <span className="text-white font-mono mt-1 block font-semibold">{selectedProfileOrder.customer.phone || '+880 1611-334455'}</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Customer Notes / Ring instructions</span>
                          <span className="text-orange-300 font-medium italic mt-1 block leading-relaxed">
                            "{selectedProfileOrder.customerNotes?.[0] || 'Deliver after hours. Ring bell three times.'}"
                          </span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-[#8E9BAE] font-medium block">Shipping Address Location</span>
                          <span className="text-white mt-1 block font-semibold leading-relaxed">
                            {selectedProfileOrder.customer.address || 'House 14, Road 4, Sector 12, Uttara, Dhaka'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. PRODUCT DETAILS SECTION */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-3.5">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-400" />
                        <span>2. Product & SKU Catalog Metrics</span>
                      </h4>
                      <div className="flex items-center gap-4">
                        <img
                          referrerPolicy="no-referrer"
                          src={selectedProfileOrder.product.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80'}
                          alt={selectedProfileOrder.product.name}
                          className="w-16 h-16 rounded-xl object-cover border border-white/5 bg-slate-950 shrink-0"
                        />
                        <div className="min-w-0 flex-1 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[#8E9BAE] font-medium block">Product Name</span>
                            <span className="text-white font-black block truncate">{selectedProfileOrder.product.name}</span>
                          </div>
                          <div>
                            <span className="text-[#8E9BAE] font-medium block">Registered SKU</span>
                            <span className="text-white font-mono font-bold block">SKU-{selectedProfileOrder.product.id}</span>
                          </div>
                          <div>
                            <span className="text-[#8E9BAE] font-medium block">Active Variant</span>
                            <span className="text-white font-medium block">Elite Edition</span>
                          </div>
                          <div>
                            <span className="text-[#8E9BAE] font-medium block">Color & Specs</span>
                            <span className="text-white font-semibold block">Crimson Space Gray (Steel Loop)</span>
                          </div>
                          <div>
                            <span className="text-[#8E9BAE] font-medium block">Quantity Ordered</span>
                            <span className="text-emerald-400 font-black text-xs block font-mono">1 Item Slot</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. PAYMENT SUMMARY INFORMATION */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-3.5">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span>3. Payment Summary & Transaction Ledger</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Product price subtotal</span>
                          <span className="text-white font-black block mt-1 text-sm">৳ {selectedProfileOrder.product.price.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Delivery charge</span>
                          <span className="text-white font-semibold block mt-1">৳ 120</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Advance Payment Amount</span>
                          <span className="text-slate-400 font-semibold block mt-1">৳ 0</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Cash On Delivery (COD)</span>
                          <span className="text-[#F4631E] font-black block mt-1 text-sm">৳ {(selectedProfileOrder.product.price + 120).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Total gross amount</span>
                          <span className="text-white font-black block mt-1 text-sm bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit">
                            ৳ {(selectedProfileOrder.product.price + 120).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] block uppercase text-[10px]">Payment Method Gateway</span>
                          <span className="text-white block mt-1 font-sans font-bold">COD (On Delivery)</span>
                        </div>
                      </div>
                    </div>

                    {/* 4. SHIPPING INFORMATION */}
                    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-3.5">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>4. Shipping Information & Logs</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Active Logistics Courier</span>
                          <span className="text-white font-semibold mt-1 block">Pathao / SteadFast BD Courier</span>
                        </div>
                        <div>
                          <span className="text-[#8E9BAE] font-medium block">Tracking URL Reference</span>
                          <a
                            href={selectedProfileOrder.trackingUrl || 'https://steadfast.com.bd/track'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#F4631E] hover:underline flex items-center gap-1 font-mono mt-1 font-bold"
                          >
                            <span>Click to track parcel</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right part: Status updating sidebar */}
                  <div className="md:col-span-4 space-y-6">
                    <div className="border border-[#F4631E]/20 bg-[#F4631E]/5 rounded-2xl p-5 space-y-4">
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Order Management Controls</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Update shipment track and client status here. Modifying will trigger immediate system notifications.
                      </p>

                      <div className="space-y-4 pt-1 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase">Dispatch Order Status</label>
                          <select
                            defaultValue={selectedProfileOrder.status}
                            onChange={(e) => {
                              const newStatus = e.target.value as any;
                              updateOrderStatus(selectedProfileOrder.id, newStatus);
                              selectedProfileOrder.status = newStatus;
                              setSelectedProfileOrder({ ...selectedProfileOrder });
                              
                              // Automatically deliver inbox message thread notifications
                              sendChatMessage(
                                selectedProfileOrder.id,
                                `[SYSTEM INBOX MESSAGE] Order ${selectedProfileOrder.id} has been modified by the merchant. Current dispatch status: ${newStatus}. Details: Logistics package catalog updated.`,
                                'seller',
                                seller.storeName
                              );
                              
                              showToast(`Order status set to ${newStatus}. Client notified.`, 'success');
                            }}
                            className="w-full bg-slate-900 border border-app-border rounded-xl px-3 py-2 text-white outline-none text-xs font-bold font-sans"
                          >
                            <option value="Pending">Pending Validation</option>
                            <option value="Processing">Processing / Packaged</option>
                            <option value="In Transit">Shipped / In Transit</option>
                            <option value="Delivered">Delivered Successfully</option>
                            <option value="Cancelled">Cancelled Listing</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase">Courier Partner</label>
                          <input
                            type="text"
                            defaultValue="Paperfly Logistics"
                            placeholder="Courier Agent"
                            className="w-full bg-slate-900 border border-app-border rounded-xl px-3 py-2 text-white outline-none font-semibold text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase">Courier Tracking Reference</label>
                          <input
                            type="text"
                            defaultValue={`TRK-P-${selectedProfileOrder.id}`}
                            placeholder="Tracking ID"
                            className="w-full bg-slate-900 border border-app-border rounded-xl px-3 py-2 text-white font-mono outline-none text-xs"
                          />
                        </div>

                        <button
                          onClick={() => {
                            showToast(`Shipping and Tracking values saved. User notification triggered.`, 'success');
                          }}
                          className="w-full bg-[#F4631E] hover:bg-[#F4631E]-light text-white font-bold py-3.5 rounded-xl block text-center uppercase tracking-wider text-[10px] cursor-pointer shadow-lg transition-all"
                        >
                          Push Shipment Updates
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ORDERS LIST CONTEXT */
              <div className="space-y-4">
                <div className="bg-app-card border border-app-border rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative flex-1 group w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#F4631E]" />
                    <input
                      type="text"
                      placeholder="Search orders by Product Name, Customer, Courier ID..."
                      value={ordersSearchQuery}
                      onChange={(e) => setOrdersSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white/[0.02] border border-app-border rounded-xl text-xs w-full focus:outline-none focus:border-[#F4631E]/40 text-white placeholder-slate-500 font-medium"
                    />
                  </div>
                </div>

                <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
                  <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-white/[0.01]">
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Merchant order records</h3>
                      <p className="text-[10px] text-app-text-secondary mt-0.5">Manage, print, track and update order streams of the store.</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">TOTAL ORDER FEED: {
                      orders.filter(o => 
                        o.product.sellerId === id ||
                        o.product.sellerName.toLowerCase().includes(seller.storeName.replace("Online", "").trim().toLowerCase()) ||
                        seller.storeName.replace("Online", "").trim().toLowerCase().includes(o.product.sellerName.toLowerCase())
                      ).length || orders.length
                    } orders</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-app-border text-slate-400 text-[10px] uppercase font-bold tracking-widest bg-white/[0.01]">
                          <th className="p-4">ID</th>
                          <th className="p-4">Customer</th>
                          <th className="p-4">Ordered SKU</th>
                          <th className="p-4">Date</th>
                          <th className="p-4 text-right">Sum BDT</th>
                          <th className="p-4 text-center">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border">
                        {orders
                          .map(o => ({
                            ...o,
                            // Adapt the order dynamically to make sure it looks correct for our seller if no exact match
                            product: (
                              o.product.sellerId === id ||
                              o.product.sellerName.toLowerCase().includes(seller.storeName.replace("Online", "").trim().toLowerCase()) ||
                              seller.storeName.replace("Online", "").trim().toLowerCase().includes(o.product.sellerName.toLowerCase())
                            ) ? o.product : { ...o.product, sellerId: id, sellerName: seller.storeName }
                          }))
                          .filter(o => {
                            if (!ordersSearchQuery) return true;
                            const query = ordersSearchQuery.toLowerCase();
                            return o.id.toLowerCase().includes(query) ||
                              o.product.name.toLowerCase().includes(query) ||
                              o.customer.name.toLowerCase().includes(query);
                          })
                          .map(order => (
                            <tr key={order.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="p-4 font-mono font-bold text-[#F4631E]">{order.id}</td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                    {order.customer.name[0]}
                                  </div>
                                  <button
                                    onClick={() => setSelectedLimitedCustomer({ ...order.customer, phone: order.customer.phone || '+880 1611-334455' })}
                                    className="text-white hover:text-[#F4631E] font-bold underline decoration-dotted text-xs cursor-pointer transition-colors"
                                  >
                                    {order.customer.name}
                                  </button>
                                </div>
                              </td>
                              <td className="p-4 text-xs font-semibold text-slate-200">
                                <div className="truncate max-w-[150px]" title={order.product.name}>{order.product.name}</div>
                              </td>
                              <td className="p-4 text-slate-400 font-mono text-[10.5px]">
                                {new Date(order.timestamp).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-right font-mono font-black text-white">৳ {order.product.price.toLocaleString()}</td>
                              <td className="p-4 text-center">
                                <span className={`text-[8.5px] px-2 py-0.5 rounded-[2px] font-black uppercase tracking-wider ${
                                  order.status === 'Delivered'
                                    ? 'bg-green-500/10 text-green-400'
                                    : order.status === 'Cancelled'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-orange-500/10 text-orange-400'
                                }`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => setSelectedProfileOrder(order)}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10.5px] border border-app-border cursor-pointer transition-all font-bold"
                                >
                                  Process
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
          </div>
        )}

        {/* CUSTOMER LIMITED PROFILE PRIVACY-PROTECTED DIALOG MODAL */}
        {selectedLimitedCustomer && (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-app-card border border-app-border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl space-y-6 p-6 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start border-b border-white/[0.04] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Customer Privacy-Protected Profile</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Limited merchant view (SLA clearance context only). No cross-merchant logs.</p>
                </div>
                <button
                  onClick={() => setSelectedLimitedCustomer(null)}
                  className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded border border-app-border text-slate-400 hover:text-white transition-all text-xs cursor-pointer font-bold"
                >
                  Close
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#F4631E]/20 text-[#F4631E] flex items-center justify-center font-extrabold text-lg border border-[#F4631E]/30 shrink-0">
                  {selectedLimitedCustomer.name[0]}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-sm font-black text-white">{selectedLimitedCustomer.name}</h4>
                  <p className="text-xs text-[#F4631E] font-medium uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded w-fit">
                    Active Consumer Client
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                  <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Phone Contact</span>
                  <span className="text-white font-mono mt-1 block font-semibold">{selectedLimitedCustomer.phone || '+880 1611-334455'}</span>
                </div>
                <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                  <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Consumer Score</span>
                  <span className="text-white font-mono mt-1 block font-black text-emerald-400">96 / 100 Quality</span>
                </div>
                <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                  <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Courier Status Integrity</span>
                  <span className="text-white font-semibold mt-1 block">Excellent (COD Trust Verified)</span>
                </div>
                <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                  <span className="text-[9.5px] text-[#8E9BAE] font-bold block uppercase">Action triggers</span>
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={() => {
                        triggerPhone({ id: selectedLimitedCustomer.id, name: selectedLimitedCustomer.name, phone: selectedLimitedCustomer.phone || '+880 1611-334455', role: 'Consumer' });
                        showToast('Sticking dial protocol for phone call connection.', 'success');
                      }}
                      className="p-1 px-2.5 bg-[#F4631E]/20 text-[#F4631E] hover:bg-[#F4631E]/30 transition-all text-[10px] font-bold rounded"
                    >
                      Call Contact
                    </button>
                    <button
                      onClick={() => {
                        triggerMessage({ id: selectedLimitedCustomer.id, name: selectedLimitedCustomer.name, role: 'Consumer' });
                        showToast('Chat dialogue session initiated.', 'success');
                      }}
                      className="p-1 px-2.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all text-[10px] font-bold rounded"
                    >
                      Instant Message
                    </button>
                  </div>
                </div>
              </div>

              {/* ONLY history with this seller */}
              <div className="space-y-2.5 pt-2">
                <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest border-b border-white/[0.04] pb-1">
                  History with {seller.storeName}
                </h4>
                <div className="max-h-[140px] overflow-y-auto space-y-2 divide-y divide-white/[0.02] pr-1 scrollbar-thin">
                  {orders
                    .map(o => ({
                      ...o,
                      product: (
                        o.product.sellerId === id ||
                        o.product.sellerName.toLowerCase().includes(seller.storeName.replace("Online", "").trim().toLowerCase()) ||
                        seller.storeName.replace("Online", "").trim().toLowerCase().includes(o.product.sellerName.toLowerCase())
                      ) ? o.product : { ...o.product, sellerId: id, sellerName: seller.storeName }
                    }))
                    .filter(o => o.customer.email === selectedLimitedCustomer.email)
                    .map(item => (
                      <div key={item.id} className="flex justify-between items-center text-xs pt-2">
                        <div>
                          <span className="text-white font-mono font-bold text-[#F4631E]">{item.id}</span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-300 font-medium truncate max-w-[125px] inline-block align-middle">{item.product.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#8E9BAE] font-mono text-[10.5px]">৳ {item.product.price.toLocaleString()}</span>
                          <span className={`text-[8.5px] px-1.5 py-0.5 rounded-[2px] font-bold uppercase tracking-wider ${
                            item.status === 'Delivered'
                              ? 'bg-green-500/10 text-green-400'
                              : 'bg-orange-500/10 text-orange-400'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  {orders
                    .map(o => ({
                      ...o,
                      product: (
                        o.product.sellerId === id ||
                        o.product.sellerName.toLowerCase().includes(seller.storeName.replace("Online", "").trim().toLowerCase()) ||
                        seller.storeName.replace("Online", "").trim().toLowerCase().includes(o.product.sellerName.toLowerCase())
                      ) ? o.product : { ...o.product, sellerId: id, sellerName: seller.storeName }
                    }))
                    .filter(o => o.customer.email === selectedLimitedCustomer.email).length === 0 && (
                      <p className="text-[11px] text-slate-500 italic">No historical orders logged with this shop yet.</p>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECTION E TRUST & REPUTATION */}
        {activeSubTab === 'reputation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Ledgers */}
            <div className={`${isSeller ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>
              
              {/* SECTION E: Trust Events */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-app-accent" />
                  SECTION E — Certified Trust Ledger & Verification Audit Trail
                </h3>
                
                <div className="space-y-3 pt-1">
                  {seller.trustEvents.map(evt => (
                    <div key={evt.id} className="p-4 bg-app-bg/50 border border-white/5 rounded-xl flex items-start gap-3.5 hover:border-white/10 transition-all">
                      <div className={`p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <h4 className="text-xs font-bold text-white">{evt.title}</h4>
                          <span className="text-[10px] text-app-text-secondary font-mono">{evt.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{evt.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION F: Recent Activity timeline (adaptable for activities list) */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-[#F4631E]" />
                  SECTION F — Interactive Recent Activity Feed & Logging Flow
                </h3>

                <div className="space-y-4 pt-1 border-l border-white/5 pl-4 ml-2">
                  {seller.recentActivities.map((act, i) => (
                    <div key={i} className="relative space-y-1">
                      <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 bg-[#F4631E] rounded-full border border-app-card" />
                      <span className="text-[9.5px] text-[#8E9BAE] font-mono leading-none m-0">{act.subtitle}</span>
                      <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    </div>
                  ))}
                  <div className="relative space-y-1">
                    <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 bg-gray-500 rounded-full border border-app-card" />
                    <span className="text-[9.5px] text-[#8E9BAE] font-mono leading-none m-0">May 18, 2026 | 10:15am</span>
                    <h4 className="text-xs font-bold text-white">Verification Center Approved & Certified</h4>
                  </div>
                  <div className="relative space-y-1">
                    <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 bg-gray-500 rounded-full border border-app-card" />
                    <span className="text-[9.5px] text-[#8E9BAE] font-mono leading-none m-0">May 14, 2026 | 02:00pm</span>
                    <h4 className="text-xs font-bold text-white">NID Identity Scan submitted</h4>
                  </div>
                </div>
              </div>

            </div>

            {/* SECTION E: Control Panel and Admin actions */}
            {!isSeller && (
              <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-5">
                <div className="border-b border-white/[0.04] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#F4631E]" />
                    Admin & Super Admin Action Console
                  </h3>
                  <p className="text-[11px] text-[#8E9BAE] mt-1">Registry operations, trust parameters, and policy controls.</p>
                </div>

                <div className="space-y-4">
                  {/* Status buttons */}
                  <div className="space-y-2">
                    <span className="text-[9px] text-[#8E9BAE] uppercase font-bold tracking-widest block">Registry Store Status</span>
                    {!(isSuperAdmin) && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[10.5px] text-slate-400 mb-2 leading-relaxed">
                        <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>Registry Status variables are locked. **Super Admin permissions required** to suspend or re-active sellers.</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleModifyStatus('Approved')}
                        disabled={seller.status === 'Approved'}
                        className={`py-2 px-3 rounded-lg text-[10px] font-bold text-center border transition-all ${
                          seller.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 border-app-border hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 cursor-pointer'
                        }`}
                      >
                        Registry: Approve
                      </button>
                      <button
                        onClick={() => handleModifyStatus('Suspended')}
                        disabled={seller.status === 'Suspended'}
                        className={`py-2 px-3 rounded-lg text-[10px] font-bold text-center border transition-all ${
                          seller.status === 'Suspended'
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-white/5 border-app-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 cursor-pointer'
                        }`}
                      >
                        Registry: Suspend
                      </button>
                    </div>
                  </div>

                  {/* Trust Calibration */}
                  <div className="space-y-2 pt-3 border-t border-white/[0.03]">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-[#8E9BAE] uppercase font-bold tracking-widest">Base Trust Index Score</span>
                      <span className="font-mono text-emerald-400 font-extrabold text-[13px]">{seller.trustScore}/100</span>
                    </div>
                    {!(isSuperAdmin) && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[10.5px] text-slate-400 mb-2 leading-relaxed">
                        <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>Trust weight modifiers are locked. **Super Admin permissions required** to run manually.</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleModifyTrustScore(2)}
                        disabled={!isSuperAdmin}
                        className="py-1.5 px-2 bg-white/5 hover:bg-[#F4631E]/5 border border-app-border hover:border-app-accent text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Score +2
                      </button>
                      <button
                        onClick={() => handleModifyTrustScore(-2)}
                        disabled={!isSuperAdmin}
                        className="py-1.5 px-2 bg-white/5 hover:bg-[#F4631E]/5 border border-app-border hover:border-app-accent text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Score -2
                      </button>
                    </div>
                  </div>

                  {/* Standard Operations */}
                  <div className="space-y-2 pt-3 border-t border-white/[0.03]">
                    <span className="text-[9px] text-[#8E9BAE] uppercase font-bold tracking-widest block">Operational Actions (All Admins)</span>
                    <button
                      onClick={() => showToast('✓ Warning notice sent. Store record updated in Incident Database.', 'success')}
                      className="w-full py-2 bg-white/5 hover:bg-[#F4631E]/5 border border-amber-500/10 hover:border-amber-500/40 text-amber-500 text-[10.5px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Send Policy warning
                    </button>
                    <button
                      onClick={() => showToast('✓ Platform manual surveillance alert flagged for this seller.', 'success')}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-app-border text-slate-300 hover:text-white text-[10.5px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Flag Manual Risk Audit
                    </button>
                    <button
                      onClick={() => showToast('✓ Clean system integrity recalculation completed.', 'success')}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 border border-app-border text-slate-300 hover:text-white text-[10.5px] font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Force recalculate calculations
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          </div>
        )}

        {/* TAB 5: REQUIRED CHANGE 3 VERIFICATION CENTER INTEGRATION */}
        {activeSubTab === 'verification' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Checklist & Documents */}
            <div className={`${isSeller ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>
              
              {/* Checklist verification interactive block */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-white/[0.04] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-app-accent" />
                      Verification KYC Audit Checklist
                    </h3>
                    <p className="text-[11px] text-app-text-secondary">Administrative authentication board. Toggle checks dynamically.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded font-bold">
                    Application Status: APPROVED
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  {[
                    { field: 'identity' as const, title: 'NID / KYC Identity Verification', icon: UserCheck, desc: 'Verified photo match and national identity number registry match.' },
                    { field: 'tradeLicense' as const, title: 'Corporate Trade License Registration', icon: FileSpreadsheet, desc: 'Trade License verified with Ministry of Commerce database registry.' },
                    { field: 'vatCert' as const, title: 'NBR Revenue Tax VAT Certification', icon: Percent, desc: 'TIN & 15% VAT identification cert check passed.' },
                    { field: 'bankDetails' as const, title: 'Settlement Bank Account Verification', icon: ShoppingBag, desc: 'Official bank routing and SCB settlement letter check.' }
                  ].map((check, i) => {
                    const status = checklistState[check.field];
                    return (
                      <div key={i} className="p-4 bg-app-bg/50 border border-white/5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex gap-3.5 items-start">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            status === 'Passed' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                          }`}>
                            <check.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-white">{check.title}</h4>
                            <p className="text-[11px] text-app-text-secondary leading-relaxed mt-0.5">{check.desc}</p>
                          </div>
                        </div>

                        {/* Interactive toggle badges */}
                        {isSeller ? (
                          <span className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border font-sans select-none ${
                            status === 'Passed'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : status === 'Rejected'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            Verification Code Status: {status}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 self-end md:self-center">
                            {(['Passed', 'Pending', 'Rejected'] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => handleToggleChecklist(check.field, opt)}
                                className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                  status === opt 
                                    ? opt === 'Passed'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : opt === 'Rejected'
                                        ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                    : 'bg-transparent text-slate-400 border-white/5 hover:border-slate-400'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submitted documents checklist */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-white/[0.04] pb-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Submitted Document Archives</h3>
                  <p className="text-[11px] text-[#8E9BAE]">Original PDF files and notarized corporate document copies upload.</p>
                </div>

                <div className="space-y-2.5">
                  {seller.submittedDocuments.map(doc => (
                    <div key={doc.id} className="p-3.5 bg-app-bg/50 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-white mb-0.5">{doc.name}</h4>
                          <span className="text-[10px] text-app-text-secondary font-mono">{doc.docType} • File Size: {doc.fileSize} • Uploaded: {doc.uploadDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[8.5px] font-bold uppercase border bg-green-500/10 text-emerald-400 border-green-500/20">
                          {doc.status}
                        </span>
                        <button
                          onClick={() => showToast(`✓ Fetching PDF binary preview for doc [${doc.id}]...`, 'success')}
                          className="p-1.5 border border-app-border hover:border-app-accent hover:text-white rounded text-slate-400 cursor-pointer"
                          title="Open Document File"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Timelines, notes, histories */}
            {!isSeller && (
              <div className="lg:col-span-4 space-y-6">
              
              {/* Interactive Admin Notes area */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-white/[0.04] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-app-accent" />
                    Interactive Admin Notes Log
                  </h3>
                  <p className="text-[11px] text-app-text-secondary">Official notes appended relating to merchant compliance.</p>
                </div>

                <form onSubmit={handleSaveNotes} className="space-y-3">
                  <textarea
                    rows={4}
                    value={inputNote}
                    onChange={(e) => setInputNote(e.target.value)}
                    placeholder="Enter permanent compliance notes, government lookup records or physical audit notes..."
                    className="w-full text-xs bg-slate-900 border border-app-border rounded-lg p-3 text-white focus:outline-none focus:border-app-accent placeholder-slate-600"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#F4631E] hover:bg-[#F4631E]/80 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-lg shadow-[#F4631E]/10"
                  >
                    Commit Admin Notes
                  </button>
                </form>

                {/* Notes Feed container */}
                <div className="space-y-3 pt-4 border-t border-white/[0.03] max-h-56 overflow-y-auto custom-scrollbar">
                  {adminNotesList.map((nt, idx) => (
                    <div key={idx} className="p-3 bg-white/[0.01] border-l-2 border-app-accent rounded-[3px] text-[11px] text-slate-300">
                      <p className="leading-relaxed font-sans">{nt}</p>
                      <div className="text-[9px] text-[#8E9BAE] font-mono mt-2 uppercase">Logged by kabir audit • Just now</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review History timeline log */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
                  Onboarding Review History
                </h3>

                <div className="space-y-5 pt-1">
                  {seller.reviewHistory.map((rev, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-[9.5px]">
                        <span className="font-bold text-app-accent-light">{rev.reviewer}</span>
                        <span className="text-app-text-secondary font-mono">{rev.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 italic font-mono bg-white/[0.01] p-2.5 rounded border border-white/5">
                        "{rev.comment}"
                      </p>
                    </div>
                  ))}

                  {/* Timelines stepper */}
                  <div className="pt-4 border-t border-white/[0.03] space-y-3">
                    <span className="text-[9px] text-[#8E9BAE] uppercase font-bold tracking-widest block opacity-50">Onboarding Lifecycle Tracker</span>
                    <div className="space-y-3 border-l border-white/5 pl-3 ml-2 font-mono text-[9.5px]">
                      {seller.applicationTimeline.map((time, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[18.2px] top-1 w-2 h-2 rounded-full border border-app-card ${
                            time.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-700'
                          }`} />
                          <span className="text-white font-bold block leading-relaxed">{time.stage}</span>
                          <span className="text-app-text-secondary block font-mono">{time.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          </div>
        )}

        {/* TAB 8: ACCOUNT SETTINGS (ONLY visible if isOwnProfile) */}
        {activeSubTab === 'account_settings' && isOwnProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-bottom-3 duration-300">
            
            {/* Left Hand: Editable Form */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#F4631E]" />
                    Merchant Contact & Identity Settings
                  </h3>
                  <p className="text-xs text-app-text-secondary mt-1">Configure your official store representative profile identity details. Changes are validated upon submission.</p>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSeller(prev => ({
                      ...prev,
                      name: profileName,
                      email: profileEmail,
                      phone: profilePhone,
                      address: profileAddress,
                      avatarUrl: profileAvatar
                    }));
                    showToast('✓ Store identity parameters updated successfully.', 'success');
                  }} 
                  className="space-y-5"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Official Representative Name</label>
                      <input 
                        type="text" 
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-900 border border-app-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-app-accent-light"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Official Business Email</label>
                      <input 
                        type="email" 
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-900 border border-app-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-app-accent-light"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Registered Phone Contact</label>
                      <input 
                        type="text" 
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full text-xs font-medium bg-slate-900 border border-app-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-app-accent-light"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Profile Photo URL</label>
                      <input 
                        type="text" 
                        value={profileAvatar}
                        onChange={(e) => setProfileAvatar(e.target.value)}
                        className="w-full text-xs font-mono bg-slate-900 border border-app-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-app-accent-light"
                      />
                    </div>

                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Corporate Registry Address</label>
                    <textarea 
                      rows={3}
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-900 border border-app-border rounded-xl p-4 text-white focus:outline-none focus:border-app-accent-light placeholder-slate-600 font-sans"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="py-3 px-6 bg-[#F4631E] hover:bg-[#F4631E]/80 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-[#F4631E]/10 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Profile Identity
                  </button>
                </form>
              </div>

              {/* Communication Preferences */}
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#F4631E]" />
                    Merchant Communications & Alert Channels
                  </h3>
                  <p className="text-[11px] text-[#8E9BAE] mt-0.5">Control operational system logs and alert frequencies sent from the centralized gateway monitor.</p>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start gap-4 p-4 bg-app-bg/30 border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.02] transition-all">
                    <input 
                      type="checkbox" 
                      checked={prefNotifications}
                      onChange={(e) => setPrefNotifications(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-app-accent focus:ring-0 focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Centralized Browser Push Security Alerts</span>
                      <span className="text-[10px] text-app-text-secondary mt-0.5 block">Instant alerts concerning dispatch warnings, order cancellations and login requests.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-4 p-4 bg-app-bg/30 border border-white/5 rounded-xl cursor-pointer hover:bg-[#1C2034] transition-all">
                    <input 
                      type="checkbox" 
                      checked={prefEmailAlerts}
                      onChange={(e) => setPrefEmailAlerts(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 bg-slate-900 text-app-accent focus:ring-0 focus:ring-offset-0"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Weekly Automated Commerce Summary Reports</span>
                      <span className="text-[10px] text-app-text-secondary mt-0.5 block">Consolidated report containing conversion metrics, growth figures and customer satisfied grades.</span>
                    </div>
                  </label>

                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] text-[#8E9BAE] font-bold uppercase tracking-wider block">Primary Notification Delivery Route</label>
                    <div className="flex gap-4">
                      {(['Email', 'Phone'] as const).map((method) => (
                        <button
                          key={method}
                          onClick={() => setPrefContactMethod(method)}
                          className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-widest border transition-all cursor-pointer ${
                            prefContactMethod === method
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-transparent text-slate-400 border-white/5 hover:border-slate-500'
                          }`}
                        >
                          {method} Routing Channel
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => showToast('✓ Communication routing channels updated successfully.', 'success')}
                    className="py-3 px-6 bg-white/5 hover:bg-white/10 text-white border border-app-border font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Save Communication Settings
                  </button>
                </div>
              </div>

            </div>

            {/* Right Hand: Security & Credentials */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-app-card border border-app-border rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-white/[0.04] pb-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#F4631E]" />
                    Authorized Access Controls
                  </h3>
                  <p className="text-[11px] text-[#8E9BAE] mt-1">Configure advanced authentication filters, hardware locks, and passwords.</p>
                </div>

                <div className="space-y-4 pt-1">
                  
                  <div className="flex items-center justify-between p-3 bg-[#F4631E]/5 rounded-xl border border-[#F4631E]/10">
                    <div>
                      <span className="text-xs font-bold text-white block">Two-Factor Authentication</span>
                      <span className="text-[10px] text-app-text-secondary">Requires an OTP verification code.</span>
                    </div>
                    <button 
                      onClick={() => {
                        setTwoFactorEnabled(!twoFactorEnabled);
                        showToast(twoFactorEnabled ? '⚠️ Two-factor auth deactivated.' : '✓ Two-factor auth activated.', 'success');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        twoFactorEnabled 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-white/5 text-slate-400 border-app-border hover:border-slate-400'
                      }`}
                    >
                      {twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-app-bg/40 rounded-xl border border-white/5">
                    <div>
                      <span className="text-xs font-bold text-white block">Strict Session Monitor</span>
                      <span className="text-[10px] text-app-text-secondary">Secures access from unknown IPs.</span>
                    </div>
                    <button 
                      onClick={() => {
                        setLoginSecurityLock(!loginSecurityLock);
                        showToast(loginSecurityLock ? '⚠️ IP tracking disabled.' : '✓ IP tracking enabled.', 'success');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        loginSecurityLock 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-white/5 text-slate-400 border-app-border hover:border-slate-400'
                      }`}
                    >
                      {loginSecurityLock ? 'STRICT' : 'LAX'}
                    </button>
                  </div>

                  {/* Password update fields */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!passwordOld || !passwordNew || !passwordConfirm) {
                        showToast('⚠️ Please fill out all credentials parameters.', 'warn');
                        return;
                      }
                      if (passwordNew !== passwordConfirm) {
                        showToast('⚠️ Passwords do not match.', 'warn');
                        return;
                      }
                      setPasswordOld('');
                      setPasswordNew('');
                      setPasswordConfirm('');
                      showToast('✓ Password changed successfully.', 'success');
                    }}
                    className="pt-4 border-t border-white/[0.03] space-y-3"
                  >
                    <span className="text-[9px] text-[#8E9BAE] uppercase font-bold tracking-widest block opacity-75">Modify Authentication Credentials</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#8E9BAE] uppercase font-bold">Current Password</label>
                      <input 
                        type="password" 
                        value={passwordOld}
                        onChange={(e) => setPasswordOld(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs bg-slate-900 border border-app-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-[#8E9BAE] uppercase font-bold">New Secure Password</label>
                      <input 
                        type="password" 
                        value={passwordNew}
                        onChange={(e) => setPasswordNew(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs bg-slate-900 border border-app-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-[#8E9BAE] uppercase font-bold">Confirm New Password</label>
                      <input 
                        type="password" 
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs bg-slate-900 border border-app-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4631E]"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-2 bg-[#F4631E]/10 hover:bg-[#F4631E]/20 text-[#F4631E] border border-[#F4631E]/20 hover:border-[#F4631E]/40 font-extrabold text-[11px] uppercase tracking-wider rounded-lg transition-all cursor-pointer text-center"
                    >
                      Save Password Credentials
                    </button>
                  </form>

                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
