import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useOrders, Order, OrderStatus, PaymentStatus } from '../../../contexts/OrdersContext';
import { useBrandProfiles, BrandProfile, BrandStatus } from '../../../contexts/BrandProfilesContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useContact } from '../../../contexts/ContactInteractionContext';
import { 
  Building2, 
  ShieldCheck, 
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
  Plus,
  ArrowLeft,
  Truck,
  MessageSquare,
  Shield,
  ThumbsUp,
  FileCheck,
  MoreVertical
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

import ProfileLayout from '../../../components/profile/ProfileLayout';
import ContentTable from '../../../components/profile/ContentTable';
import BrandEditStudio from '../BrandEditStudio';
import GuideStudioCMS from '../../../components/profile/GuideStudioCMS';

const getMockProductId = (title: string): string => {
  const t = title.toLowerCase();
  if (t.includes('samsung') || t.includes('s25')) return '1';
  if (t.includes('vision') || t.includes('tv')) return '2';
  if (t.includes('fridge') || t.includes('walton')) return '4';
  return '3'; // Default to Saree (Aarong Jamdani Saree)
};

// Static / fallback profiles database
const FALLBACK_CONSUMERS = [
  {
    id: 'cust_001',
    name: 'Farhan Bin Rafiq',
    email: 'farhanbinrafiq@gmail.com',
    status: 'Active',
    avatarUrl: '',
    initials: 'FR',
    persona: 'VIP Retail Wholesaler',
    emailVerified: true,
    address: 'Sector 3, Uttara, Dhaka 1230, Bangladesh',
    phone: '+880 1711-223344',
    lastActive: 'Active Now',
    totalSpent: '৳ 342,400',
    totalSpentNum: 342400,
    totalOrders: 18,
    wishlistCount: 12,
    reviewsCount: 14,
    supportTicketsCount: 0,
    retentionScore: 99,
    avgOrderValue: '৳ 19,020',
    recentActivities: [
      { id: '1', title: 'Order ARR-9952 delivered successfully', subtitle: 'Today at 09:15 AM', iconType: 'order' },
      { id: '2', title: 'Support Chat query resolved', subtitle: 'Yesterday at 04:30 PM', iconType: 'chat' },
      { id: '3', title: 'Claimed Promo Coupon HOLIDAY15', subtitle: '2 days ago', iconType: 'coupon' }
    ]
  },
  {
    id: 'cust_002',
    name: 'Mehedi Rahman',
    email: 'mehedi@yahoo.com',
    status: 'Active',
    avatarUrl: '',
    initials: 'MR',
    persona: 'Tech Sourcing Enthusiast',
    emailVerified: true,
    address: 'Mirpur 10, Dhaka, Bangladesh',
    phone: '+880 1912-334455',
    lastActive: 'Yesterday',
    totalSpent: '৳ 45,900',
    totalSpentNum: 45900,
    totalOrders: 4,
    wishlistCount: 5,
    reviewsCount: 2,
    supportTicketsCount: 1,
    retentionScore: 82,
    avgOrderValue: '৳ 11,475',
    recentActivities: [
      { id: 'a1', title: 'Opened support ticket about warranty', subtitle: '4 days ago', iconType: 'chat' },
      { id: 'a2', title: 'Placed pending order for Walton Fridge', subtitle: '5 days ago', iconType: 'order' }
    ]
  },
  {
    id: '2',
    name: 'Brooklyn Simmons',
    email: 'brooklynsim2@gmail.com',
    status: 'Active',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
    initials: 'BS',
    persona: 'High-Value Fashion Enthusiast',
    emailVerified: true,
    address: '4140 Parker Rd. Allentown, New Mexico 31134',
    phone: '+222 01 414 8447',
    lastActive: '12 December, 2023',
    totalSpent: '৳ 324,200',
    totalSpentNum: 324200,
    totalOrders: 14,
    wishlistCount: 8,
    reviewsCount: 12,
    supportTicketsCount: 0,
    retentionScore: 92,
    avgOrderValue: '৳ 23,157',
    recentActivities: [
      { id: 'b1', title: 'Earned Loyalty points multiplier voucher', subtitle: '1 week ago', iconType: 'coupon' },
      { id: 'b2', title: 'Modified shipping location profile', subtitle: '2 weeks ago', iconType: 'info' }
    ]
  }
];

const FALLBACK_SELLERS = [
  {
    id: '1',
    name: 'Rahim Uddin',
    storeName: 'Aarong Digital Ltd',
    email: 'merchant.support@aarong.com',
    phone: '+880 1819-112233',
    address: '34, Orchard Road East, Dhanmondi, Dhaka 1209, Bangladesh',
    verificationStatus: 'Verified',
    applicationStatus: 'Approved',
    legalId: 'TRADE-RE-9410A',
    bin: 'BIN-10928391039',
    tin: 'TIN-48291039401',
    operationalHealth: 'Excellent',
    trustScore: 98,
    ordersCount: 342,
    productCount: 140,
    revenue: '৳ 1,424,500',
    fulfillmentRate: '99.2%',
    settlementPlan: 'T+3 Business Days Direct Escrow Transfer',
    recentActivities: [
      { id: 's1', title: 'Affiliate campaign balance processed', subtitle: 'Yesterday', iconType: 'order' },
      { id: 's2', title: 'Submitted 14 new product variations', subtitle: '4 days ago', iconType: 'info' }
    ],
    brands: [
      { id: 'b1', name: 'Aarong Fabric', status: 'VERIFIED_OWNER', commissionCut: '5.5%' },
      { id: 'b2', name: 'Jamdani Royal', status: 'APPROVED_PARTNER', commissionCut: '7%' }
    ]
  }
];

const FALLBACK_CREATORS = {
  '1': {
    id: '1',
    name: 'Rifat Hasan',
    handle: '@rifat_reviews',
    status: 'Active',
    verificationStatus: 'Verified',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
    persona: 'High-Value Fashion & Saree Curator',
    email: 'rifat.h@choosify.com',
    address: '34, Orchard Road East, Dhanmondi, Dhaka 1209, Bangladesh',
    phone: '+880 1819-223344',
    lastActive: 'Active Now',
    totalViews: '45.2K views',
    totalContent: 142,
    revenueGenerated: '৳ 382,200',
    followers: '42.5k',
    engagementRate: '12.4%',
    campaignParticipationCount: 8,
    conversionRate: '5.8%',
    specialties: ['Mobile Phones', 'Laptops', 'Audio', 'Traditional Fabrics'],
    recentActivities: [
      { iconType: 'rating', title: 'Content Approved', subtitle: 'Friday, Sep 6, 2026 | 12:24am' },
      { iconType: 'chat', title: 'Collaged Brand Pitch', subtitle: 'Thursday, Sep 5, 2026 | 10:15am' },
      { iconType: 'order', title: 'Affiliate Payout Recieved', subtitle: 'Tuesday, Sep 3, 2026 | 09:30pm' }
    ],
    contentGroups: [
      {
        date: 'Date of Submission 10 May, 2026',
        campaignId: 'Campaign ID: CAM-99410',
        items: [
          {
            id: 'c-rifat-1',
            title: 'Top Summer Jamdani Closets 2026',
            category: 'Boutique Closets',
            clicks: '42.5K views',
            status: 'Live',
            date: '10 May, 2026',
            thumbnail: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=120&h=120'
          }
        ]
      }
    ]
  },
  '6': {
    id: '6',
    name: 'Sumaiya Rahman',
    handle: '@sumaiyaluxe',
    status: 'Active',
    verificationStatus: 'Verified',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
    persona: 'Premium Lifestyle & Beauty Reviewer',
    email: 'sumaiya.r@choosify.com',
    address: 'Gulshan-2, Dhaka, Bangladesh',
    phone: '+880 1711-556677',
    lastActive: '2 days ago',
    totalViews: '89.4K views',
    totalContent: 210,
    revenueGenerated: '৳ 640,500',
    followers: '92.1k',
    engagementRate: '15.2%',
    campaignParticipationCount: 14,
    conversionRate: '7.4%',
    specialties: ['Skincare', 'Designer Saree', 'Jewelry Accessories'],
    recentActivities: [
      { iconType: 'chat', title: 'SLA Brand Contract Signed', subtitle: '3 days ago' },
      { iconType: 'order', title: 'Payout Approved', subtitle: '5 days ago' }
    ],
    contentGroups: [
      {
        date: 'Date of Submission 12 June, 2026',
        campaignId: 'Campaign ID: CAM-88120',
        items: [
          {
            id: 'c-sumaiya-1',
            title: 'Modern Muslin Elegant Guide for Weddings',
            category: 'Luxury Fashion',
            clicks: '89.4K views',
            status: 'Live',
            date: '12 June, 2026',
            thumbnail: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=120&h=120'
          }
        ]
      }
    ]
  },
  '7': {
    id: '7',
    name: 'Tahmid Alvi',
    handle: '@tahmidtech',
    status: 'In Review',
    verificationStatus: 'Pending',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256',
    persona: 'Tech gadget spec analyst & reviewer',
    email: 'tahmid.alvi@choosify.com',
    address: 'Dhanmondi, Dhaka, Bangladesh',
    phone: '+880 1912-789012',
    lastActive: 'Just Now',
    totalViews: '210.5K views',
    totalContent: 320,
    revenueGenerated: '৳ 1,210,000',
    followers: '250.4k',
    engagementRate: '9.8%',
    campaignParticipationCount: 22,
    conversionRate: '4.2%',
    specialties: ['Gadgets', 'Smartwatches', 'Custom PC'],
    recentActivities: [
      { iconType: 'rating', title: 'Video review flagged', subtitle: 'Today at 02:11am' },
      { iconType: 'chat', title: 'Submitted Profile Appeal', subtitle: 'Yesterday' }
    ],
    contentGroups: [
      {
        date: 'Date of Submission June 1, 2026',
        campaignId: 'Campaign ID: CAM-77123',
        items: [
          {
            id: 'c-tahmid-1',
            title: 'Which Smartwatch to buy in Khulna/Dhaka?',
            category: 'Wearables',
            clicks: '210.5K views',
            status: 'Draft',
            date: ' June 1, 2026',
            thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=120&h=120'
          }
        ]
      }
    ]
  }
};

const INITIAL_GUIDES = [
  {
    id: 'GUIDE-991',
    guideTitle: 'The Ultimate Handloom Saree Buyer Guide 2026',
    category: 'Traditional Fabrics',
    audienceType: 'General Wedding Seekers',
    readTime: '6m read',
    winnerProduct: 'Aarong Premium Jamdani Saree',
    bestBudgetPick: 'Rajshahi Silk Cotton Blend',
    flaggedByModerator: false,
    verifiedContributor: true,
    authorName: 'Rifat Hasan',
    status: 'Live',
    lastUpdated: '14 June, 2026'
  },
  {
    id: 'GUIDE-992',
    guideTitle: 'Budget Gadgets: Best Budget Phones under ৳15,000',
    category: 'Mobile Phones',
    audienceType: 'Students & Budget Sourcing',
    readTime: '8m read',
    winnerProduct: 'Walton Primo ZX8',
    bestBudgetPick: 'Symphony Z40 Pro',
    flaggedByModerator: false,
    verifiedContributor: true,
    authorName: 'Rifat Hasan',
    status: 'Live',
    lastUpdated: '12 June, 2026'
  }
];

// Configuration maps for Tabs modules
const UPE_CONFIG: Record<string, string[]> = {
  consumer: ['account', 'orders', 'reviews', 'followed_brands', 'saved_items', 'followed_creators', 'search_history'],
  seller: ['account', 'verification', 'portfolio', 'products', 'orders', 'reviews', 'ads'],
  brand: ['account', 'verification', 'portfolio', 'products', 'orders', 'reviews', 'ads'],
  order: ['overview', 'customer', 'logistics', 'finance', 'timeline'],
  creator: ['account', 'verification', 'portfolio', 'recommended_products', 'content_listings', 'reviews']
};

const defaultSubTabMap: Record<string, string> = {
  consumer: 'account',
  seller: 'account',
  brand: 'account',
  order: 'overview',
  creator: 'account'
};

export default function UnifiedProfileShell() {
  const { entityType, entityId, id } = useParams<{ entityType?: string; entityId?: string; id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { orders, customers, approveOrder, dispatchOrder, cancelOrder, addCustomerNotes, sendChatMessage } = useOrders();
  const { profiles: brandProfiles } = useBrandProfiles();
  const { profile: loggedInProfile } = useAuth();
  const { triggerMessage, triggerPhone } = useContact();

  // Derive active type and id, supporting legacy upe paths and direct /consumer/:id routes
  const typeKey = useMemo(() => {
    if (entityType) return entityType.toLowerCase();
    const path = location.pathname.toLowerCase();
    if (path.includes('/consumer/')) return 'consumer';
    if (path.includes('/seller/')) return 'seller';
    if (path.includes('/brand/')) return 'brand';
    if (path.includes('/order/')) return 'order';
    if (path.includes('/creator/')) return 'creator';
    
    // Support embedding in dashboard
    if (path.includes('/dashboard')) return 'seller';
    
    // Legacy support plural and singular
    if (path.includes('/consumers/')) return 'consumer';
    if (path.includes('/sellers/')) return 'seller';
    if (path.includes('/brands/')) return 'brand';
    if (path.includes('/orders/')) return 'order';
    if (path.includes('/creators/')) return 'creator';
    return 'consumer';
  }, [entityType, location.pathname]);

  const idKey = entityId || id || (typeKey === 'seller' ? '1' : '');

  // Tab routing control
  const [activeTab, setActiveTab] = useState('');
  useEffect(() => {
    setActiveTab(defaultSubTabMap[typeKey] || 'identity');
  }, [typeKey]);

  // Global search filters
  const [searchQuery, setSearchQuery] = useState('');

  // Product and Order status filters
  const [prodStatusFilter, setProdStatusFilter] = useState<'All' | 'Active' | 'Draft' | 'Pending Review' | 'Rejected' | 'Archived'>('All');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | 'Pending' | 'Confirmed' | 'Processing' | 'Dispatched' | 'In Transit' | 'Delivered' | 'Cancelled' | 'Returned' | 'Exchanged' | 'Other'>('All');

  // Active selected brand ID for visual portfolio CMS customization
  const [selectedCMSBrandId, setSelectedCMSBrandId] = useState<string>('');

  useEffect(() => {
    if (typeKey === 'seller') {
      const match = FALLBACK_SELLERS.find(s => s.id === idKey) || FALLBACK_SELLERS[0];
      if (match?.brands && match.brands.length > 0) {
        setSelectedCMSBrandId(match.brands[0].id);
      }
    } else if (typeKey === 'brand') {
      setSelectedCMSBrandId(idKey || '1');
    }
  }, [typeKey, idKey]);

  // Toast Notifications
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // State for dispatch parameters log on orders logistics
  const [transitUpdateText, setTransitUpdateText] = useState('');
  const [chatMessageText, setChatMessageText] = useState('');
  const [customNoteText, setCustomNoteText] = useState('');

  // Creator profile specific state
  const [creatorGuides, setCreatorGuides] = useState(INITIAL_GUIDES);
  const [selectedGuide, setSelectedGuide] = useState<any>(null);
  const [creatorRecommendedProducts, setCreatorRecommendedProducts] = useState([
    { id: 'rp101', title: 'Traditional Tangail Handloom Saree', brand: 'Aarong Fabric House', category: 'Traditional Wear', price: 4500, image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=120&h=120', affiliateStatus: 'Active Referral (8% Cut)', date: '14 May, 2026', performance: '1,420 Clicks (124 conversions)', status: 'Active' },
    { id: 'rp102', title: 'Summer Cotton Silk Saree', brand: 'Jamdani Royal Heritage', category: 'Premium Wear', price: 4200, image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=120&h=120', affiliateStatus: 'Active Referral (10% Cut)', date: '12 May, 2026', performance: '920 Clicks (82 conversions)', status: 'Active' },
    { id: 'rp103', title: 'Muslin Silk Exquisite Jamdani Saree', brand: 'Jamdani Royal Heritage', category: 'Heritage Wear', price: 25000, image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=120&h=120', affiliateStatus: 'Standard Tag', date: '08 May, 2026', performance: '4,510 Clicks (310 conversions)', status: 'Active' },
    { id: 'rp104', title: 'Monsoon Pure Nakshi Kantha Saree', brand: 'Aarong Fabric House', category: 'Traditional Weaves', price: 12500, image: 'https://images.unsplash.com/photo-1561053720-76cd73ff22c3?auto=format&fit=crop&q=80&w=120&h=120', affiliateStatus: 'Inactive Referral', date: '01 May, 2026', performance: '110 Clicks (0 conversions)', status: 'Hidden' },
    { id: 'rp105', title: 'Synthetic Georgette Kurti', brand: 'Aarong Fabric House', category: 'Casual Wear', price: 2100, image: 'https://images.unsplash.com/photo-1608748010899-18f300247112?auto=format&fit=crop&q=80&w=120&h=120', affiliateStatus: 'Active Referral', date: '21 April, 2026', performance: '50 Clicks (2 conversions)', status: 'Archived' }
  ]);
  const [creatorContentListings, setCreatorContentListings] = useState([
    { id: 'cl101', title: 'Saree Draping Mastery: 5 Traditional Styles', type: 'Tutorial', publishDate: '12 June, 2026', views: '24.5K', likes: '1.2K', saves: '942', shares: '430', status: 'Published', thumbnail: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl102', title: 'Why Genuine Muslin Jamdani Worth the PriceTag', type: 'Buying Guide', publishDate: '10 June, 2026', views: '15.2K', likes: '910', saves: '412', shares: '221', status: 'Published', thumbnail: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl103', title: 'Summer Boutique Closet Wardrobe Tour', type: 'Short Clip', publishDate: '08 June, 2026', views: '82.4K', likes: '6.4K', saves: '2.1K', shares: '1.8K', status: 'Published', thumbnail: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl104', title: 'Traditional Silk Loom Authentic vs Artificial', type: 'Product Review', publishDate: '01 June, 2026', views: '8.4K', likes: '320', saves: '185', shares: '42', status: 'Under Review', thumbnail: 'https://images.unsplash.com/photo-1561053720-76cd73ff22c3?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl105', title: 'Eid Heritage Loom Collection Preview', type: 'Collection', publishDate: 'Scheduled for July 1', views: '0', likes: '0', saves: '0', shares: '0', status: 'Scheduled', thumbnail: 'https://images.unsplash.com/photo-1608748010899-18f300247112?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl106', title: 'Unboxing Handloom Weaves Cargo Dispatch', type: 'Video', publishDate: '14 May, 2026', views: '12.1K', likes: '512', saves: '240', shares: '105', status: 'Published', thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=120&h=120' },
    { id: 'cl107', title: 'Dhaka Heritage Walk & Saree Shopping Guide', type: 'Article', publishDate: '12 May, 2026', views: '5.2K', likes: '224', saves: '150', shares: '38', status: 'Draft', thumbnail: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=120&h=120' }
  ]);
  const [recProductStatusFilter, setRecProductStatusFilter] = useState<'All' | 'Active' | 'Hidden' | 'Archived'>('All');
  const [contentListingsStatusFilter, setContentListingsStatusFilter] = useState<'All' | 'Published' | 'Draft' | 'Scheduled' | 'Under Review' | 'Archived'>('All');

  // Consumer profile specific state for dynamic interaction in standard workspaces
  const [consumerSearchHistory, setConsumerSearchHistory] = useState([
    { id: 'sh_1', keyword: 'Traditional Silk Saree handloom', category: 'Traditional Wear', time: 'Today at 10:14 AM', results: 142, device: 'iPhone 15 Pro (Safari)' },
    { id: 'sh_2', keyword: 'White premium linen Kurti', category: 'Menswear & Casuals', time: 'Yesterday at 04:22 PM', results: 18, device: 'Windows 11 (Chrome)' },
    { id: 'sh_3', keyword: 'Muslin luxury gold thread work', category: 'Premium Sarees', time: '14 June, 2026', results: 89, device: 'Android 14 (Firefox)' },
    { id: 'sh_4', keyword: 'Handmade leather sandal size 42', category: 'Footwear & Accents', time: '12 June, 2026', results: 4, device: 'MacBook Air (Safari)' },
    { id: 'sh_5', keyword: 'Natural organic velvet jewelry pouch', category: 'Jewelry & Accessories', time: '10 June, 2026', results: 0, device: 'iPhone 15 Pro (Safari)' }
  ]);
  const [consumerFollowedBrands, setConsumerFollowedBrands] = useState([
    { id: 'fb_1', name: 'Aarong Fabric House', logo: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=120&h=120', category: 'Saree & Ethnic Wear', verified: true, followDate: '12 January, 2025', lastActivity: 'Published Monsoon Festival Saree Catalogue today' },
    { id: 'fb_2', name: 'Jamdani Royal Heritage', logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=120&h=120', category: 'Luxury Handcrafts', verified: true, followDate: '24 February, 2025', lastActivity: 'Updated physical flagship store location details' },
    { id: 'fb_3', name: 'Muslin Silk House', logo: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=120&h=120', category: 'Elite Premium Silks', verified: false, followDate: '15 March, 2025', lastActivity: 'Distributed 15% discount pre-order coupon for loyalists' }
  ]);
  const [consumerSavedItems, setConsumerSavedItems] = useState([
    { id: 'si_1', name: 'Exquisite Hand-woven Jamdani Silk Saree', type: 'Product', brand: 'Jamdani Royal Heritage', price: 25000, image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300&h=300', availability: 'In Stock', saveDate: '12 May, 2026' },
    { id: 'si_2', name: 'Monsoon Flash Monsoon Frenzy', type: 'Deal', brand: 'Aarong Fabric House', price: 12500, image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=300&h=300', availability: 'Active Flash Deal', saveDate: '18 June, 2026' },
    { id: 'si_3', name: 'Premium Handcraft Velvet Gift Box', type: 'Collection', brand: 'Jamdani Royal Heritage', price: 4500, image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=300&h=300', availability: 'Pre-Order', saveDate: '01 June, 2026' },
    { id: 'si_4', name: 'PREMIUM-SILK-2026 Discount Coupon', type: 'Coupon', brand: 'Aarong Fabric House', price: 500, image: 'https://images.unsplash.com/photo-1557053910-d9eedeed1c71?auto=format&fit=crop&q=80&w=300&h=300', availability: 'Available Coupon', saveDate: '12 June, 2026' }
  ]);
  const [consumerFollowedCreators, setConsumerFollowedCreators] = useState([
    { id: 'c_1', name: 'Rifat Hasan', specialty: 'Elite Heritage Tex-blogger', followers: '142K', verified: true, avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120&h=120', latestContent: 'Traditional handloom versus power loom silk authenticity checklists' },
    { id: 'c_2', name: 'Nabila Karim', specialty: 'Luxury Fashion Stylist', followers: '84K', verified: true, avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120&h=120', latestContent: 'Monsoon Saree draping guides and color matching tutorials' }
  ]);

  // Account Information editable addresses/settings
  const [shippingAddress, setShippingAddress] = useState('Sector 3, Uttara, Dhaka 1230, Bangladesh');
  const [billingAddress, setBillingAddress] = useState('Sector 3, Uttara, Dhaka 1230, Bangladesh');
  const [defaultShippingAddress, setDefaultShippingAddress] = useState('Sector 3, Uttara, Dhaka 1230, Bangladesh');
  const [communicationPref, setCommunicationPref] = useState({ email: true, sms: true, push: false });
  const [selectedReviewFilter, setSelectedReviewFilter] = useState<'All' | 'Product' | 'Brand' | 'Creator'>('All');

  // Load and assemble dynamic entity data based on state configurations
  const entityData = useMemo(() => {
    if (!idKey) return null;

    if (typeKey === 'consumer') {
      const cust = customers.find(c => c.id === idKey) || FALLBACK_CONSUMERS.find(c => c.id === idKey) || FALLBACK_CONSUMERS[0];
      const associatedList = orders.filter(o => o.customer.name === cust.name || o.customer.id === cust.id);
      return {
        ...cust,
        initials: cust.initials || cust.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
        totalSpent: cust.totalSpent || `৳ ${associatedList.reduce((sum, o) => sum + (o.product.price * o.quantity), 0).toLocaleString()}`,
        totalOrders: cust.totalOrders || associatedList.length,
        wishlistCount: cust.wishlistCount || 8,
        supportTicketsCount: cust.supportTicketsCount || 0,
        retentionScore: cust.retentionScore || 95,
        recentActivities: cust.recentActivities || [
          { id: '1', title: 'Browsed winter saree categories', subtitle: 'Today at 10:45 AM', iconType: 'info' }
        ],
        orders: associatedList
      };
    }

    if (typeKey === 'seller') {
      const match = FALLBACK_SELLERS.find(s => s.id === idKey) || FALLBACK_SELLERS[0];
      const items = orders.filter(o => o.product.sellerId === match.id || o.product.sellerName === match.storeName);
      return {
        ...match,
        ordersCount: items.length || match.ordersCount,
        orders: items
      };
    }

    if (typeKey === 'brand') {
      const b = brandProfiles.find(p => p.id === idKey) || brandProfiles[0];
      if (!b) return null;
      
      const relatedOrders = orders.filter(o => o.product.brand.toLowerCase() === b.name.toLowerCase());
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description || 'Specialized premium boutique traditional fabric sync platform.',
        logo: b.logo || '',
        category: b.category || 'Traditional Saree',
        industry: b.industry || 'Traditional Handlooms',
        ownerStore: b.ownerStore || 'Aarong Digital Ltd',
        websiteUrl: b.websiteUrl || 'https://aarong.com',
        status: b.status || 'VERIFIED_OWNER',
        completionScore: b.completionScore || 94,
        referralTraffic: b.referralTraffic || 4220,
        pageViews: b.pageViews || 18450,
        searchVisibility: b.searchVisibility || 88,
        badge: b.status === 'VERIFIED_OWNER' ? 'Diamond Partner' : 'Approve Partner',
        orders: relatedOrders
      };
    }

    if (typeKey === 'creator') {
      const backup = FALLBACK_CREATORS[idKey as keyof typeof FALLBACK_CREATORS] || FALLBACK_CREATORS['1'];
      return {
        ...backup,
        contentGroups: backup.contentGroups || []
      };
    }

    if (typeKey === 'order') {
      const ord = orders.find(o => o.id === idKey);
      if (!ord) return null;

      const rawQty = ord.quantity || 1;
      const rawPrice = ord.product.price || 0;
      const rawRevenue = rawPrice * rawQty;
      const finalDel = ord.deliveryCharge || 120;
      const totalCostSum = rawRevenue + finalDel;

      const commPercent = ord.commissionPercent || 6.5;
      const commValue = Math.round((rawRevenue * commPercent) / 100);
      const sNetEarn = totalCostSum - commValue;

      const logsList = ord.orderLogs?.map((l: string) => ({ txt: l })) || [];
      const sellerNotesList = ord.sellerNotes?.map((n: string) => ({ txt: n })) || [];

      const mSeller = FALLBACK_SELLERS.find(s => s.id === ord.product.sellerId || s.storeName === ord.product.sellerName) || FALLBACK_SELLERS[0];
      const mBrand = brandProfiles.find(b => b.name.toLowerCase() === ord.product.brand.toLowerCase()) || brandProfiles[0];
      const mCust = customers.find(c => c.id === ord.customer.id || c.name === ord.customer.name) || FALLBACK_CONSUMERS[0];

      return {
        id: ord.id,
        product: ord.product,
        status: ord.status,
        paymentStatus: ord.paymentStatus,
        timestamp: ord.timestamp,
        deliveryPartner: ord.deliveryPartner || 'Paperfly Express',
        trackingUrl: ord.trackingUrl || 'https://paperfly.com.bd/tracker',
        invoiceId: ord.invoice_id || `INV-2026-${ord.id}`,
        invoiceStatus: ord.invoice_status || 'Unpaid',
        platformSource: ord.platformSource || 'WhatsApp Channel',
        quantity: rawQty,
        financials: {
          revenue: rawRevenue,
          delCharge: finalDel,
          grandTotal: totalCostSum,
          commPercent: commPercent,
          commissionCut: commValue,
          sellerNet: sNetEarn
        },
        customer: {
          id: mCust?.id || 'cust_001',
          name: ord.customer.name || mCust?.name || 'Farhan Bin Rafiq',
          email: ord.customer.email || mCust?.email || 'farhan@gmail.com',
          avatarInitials: ord.customer.avatar || 'FR',
          behavior: ord.customer.behavior || 'Good'
        },
        seller: {
          id: mSeller?.id || '1',
          name: ord.product.sellerName || mSeller?.name || 'Rahim Uddin',
          storeName: mSeller?.storeName || 'Aarong Digital Ltd'
        },
        brand: {
          id: mBrand?.id || 'brand_apex',
          name: ord.product.brand || 'Aarong Fabric'
        },
        chatHistory: [
          { sender: 'System Router', text: 'Order dispatched sync generated successfully with shipping logs.', time: 'Today 10:11 AM' },
          ...logsList.map(l => ({ sender: 'Customer Support', text: l.txt, time: 'Synced Status Update' })),
          ...sellerNotesList.map(s => ({ sender: 'Seller Merchant Note', text: s.txt, time: 'Merchant Note' }))
        ]
      };
    }

    return null;
  }, [typeKey, idKey, orders, customers, brandProfiles]);

  // Action overrides
  const handleUserBanStatusToggle = () => {
    if (typeKey === 'consumer' && entityData) {
      showToast(`🛡️ SEC SECURITY ENG: Banning audit toggled for consumer: ${entityData.name}`, 'info');
      entityData.status = entityData.status === 'Active' ? 'Banned' : 'Active';
    }
  };

  const handleSellerSuspensionToggle = () => {
    if (typeKey === 'seller' && entityData) {
      showToast(`⚙️ EOS POLICY: Seller suspension state updated for store: ${entityData.storeName}`, 'info');
    }
  };

  const handleBrandClaimStatusToggle = () => {
    if (typeKey === 'brand' && entityData) {
      showToast(`🏬 REGISTRY SWEEP: Checked and locked secure verification keys for ${entityData.name}.`, 'success');
    }
  };

  const handlePushTransitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitUpdateText.trim()) return;
    showToast(`🟢 LOGISTICS ROUTING: Dispatched tracking logs entry to Order ${entityData?.id}`, 'success');
    setTransitUpdateText('');
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageText.trim()) return;
    if (typeKey === 'order' && entityData) {
      sendChatMessage(entityData.id, chatMessageText, 'admin', loggedInProfile?.name || 'Admin Audit');
      showToast(`💬 ERP MESSAGING: Synced WhatsApp channel wireframe for client thread.`, 'success');
      chatMessageText && entityData.chatHistory.push({ sender: 'Admin Audit', text: chatMessageText, time: 'Just Now' });
      setChatMessageText('');
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNoteText.trim()) return;
    if (typeKey === 'order' && entityData) {
      addCustomerNotes(entityData.id, customNoteText);
      showToast(`📝 AUDIT NOTE: Added operational ledger memo.`, 'success');
      entityData.chatHistory.push({ sender: 'Seller Merchant Note', text: customNoteText, time: 'Just Now' });
      setCustomNoteText('');
    }
  };

  const handleOrderApproveSLA = () => {
    if (typeKey === 'order' && entityData) {
      approveOrder(entityData.id, 120, 'System manual audit confirm passed.');
      showToast(`✓ SLA SUCCESS: Approved and locked order state.`, 'success');
    }
  };

  const handleOrderDispatchSLA = () => {
    if (typeKey === 'order' && entityData) {
      dispatchOrder(entityData.id, 'eCourier Service', `TRACK-${entityData.id}-X`);
      showToast(`🚚 TRANSPORT DISPATCH: In Transit markers set on Paperfly/eCourier networks.`, 'success');
    }
  };

  const handleOrderCancelSLA = () => {
    if (typeKey === 'order' && entityData) {
      cancelOrder(entityData.id, 'Merchant request - cancellation fee standard applied.');
      showToast(`☠️ RECOVERY CANCELED: Voided transaction ledger. REFUND processed.`, 'error');
    }
  };

  const handleSaveModeration = (guideId: string, overrides: any) => {
    setCreatorGuides(prev => prev.map(g => g.id === guideId ? { ...g, ...overrides } : g));
    showToast(`✓ SYSTEM: Overrides synced successfully for ${guideId}`, 'success');
    setSelectedGuide(null);
  };

  // Safe checks for un-compiled rendering states
  if (!entityData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-app-text-primary">
        <AlertTriangle className="w-12 h-12 text-[#F4631E] animate-bounce" />
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[#F4631E]">ERROR: ENTITY RESOLUTION FAILED</p>
        <Link to="/admin/dashboard" className="mt-6 px-4 py-2 bg-app-sidebar border border-app-border rounded-lg text-xs font-bold text-app-text-primary hover:bg-white/5 transition-all flex items-center gap-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Return To Platform Central
        </Link>
      </div>
    );
  }

  // 1. Map Breadcrumbs
  const breadcrumbs = [
    { label: 'Dashboard', path: '/admin/dashboard' },
    typeKey === 'consumer' ? { label: 'Consumers', path: '/admin/consumers' } :
    typeKey === 'seller' ? { label: 'Sellers', path: '/admin/sellers' } :
    typeKey === 'brand' ? { label: 'Brands', path: '/admin/sellers' } :
    typeKey === 'order' ? { label: 'Orders', path: '/admin/orders' } :
    { label: 'Creators', path: '/admin/consumers?tab=creators' },
    { label: `${typeKey === 'order' ? `Order #${entityData.id}` : typeKey === 'seller' ? entityData.storeName : entityData.name}` }
  ];

  // 2. Map Titles and Metadata
  const title = typeKey === 'consumer' ? 'Consumer Profile' :
                typeKey === 'seller' ? 'Seller Profile' :
                typeKey === 'brand' ? 'Brand Profile' :
                typeKey === 'order' ? 'Order Profile' : 'Creator Profile';

  const subtitle = typeKey === 'consumer' ? 'Client account registry standard logs' :
                   typeKey === 'seller' ? 'NBR registered merchant legal profile & statistics' :
                   typeKey === 'brand' ? 'Ecosystem verified brand partner details' :
                   typeKey === 'order' ? 'System logistics and payment ledger status' :
                   'Expert influencer ecosystem alignment & campaign performance metrics';

  // 3. Header Action Buttons
  const headerActions = typeKey === 'creator' ? [
    {
      label: 'Feature Creator',
      onClick: () => showToast(`Featured Creator: ${entityData.name} pushed to spotlight`, 'success'),
      icon: <Award className="w-3.5 h-3.5" />
    }
  ] : typeKey === 'order' ? [
    {
      label: 'Approve Order SLA',
      onClick: handleOrderApproveSLA,
      icon: <CheckCircle className="w-3.5 h-3.5" />
    }
  ] : undefined;

  const backLink = typeKey === 'consumer' ? '/admin/consumers' :
                   typeKey === 'seller' ? '/admin/sellers' :
                   typeKey === 'brand' ? '/admin/sellers' :
                   typeKey === 'order' ? '/admin/orders' :
                   '/admin/consumers?tab=creators';

  const backLinkLabel = typeKey === 'consumer' ? 'All Consumers' :
                        typeKey === 'seller' ? 'All Sellers' :
                        typeKey === 'brand' ? 'All Brands' :
                        typeKey === 'order' ? 'All Orders' :
                        'All Creators';

  // 4. Identity Column Mapping
  const bannerText = typeKey.toUpperCase();
  const bannerGradientClass = typeKey === 'consumer' ? 'from-rose-600/30 via-app-card to-app-gradient-end' :
                              typeKey === 'seller' ? 'from-orange-600/30 via-app-card to-app-gradient-end' :
                              typeKey === 'brand' ? 'from-indigo-600/30 via-app-card to-app-gradient-end' :
                              typeKey === 'order' ? 'from-yellow-600/30 via-app-card to-app-gradient-end' :
                              'from-emerald-600/30 via-app-card to-app-gradient-end';

  const avatarUrl = typeKey === 'brand' ? entityData.logo : (entityData as any).avatarUrl;
  const initials = (entityData as any).initials || (typeKey === 'order' ? 'ORD' : typeKey === 'seller' ? 'SLR' : 'BRD');
  const name = typeKey === 'order' ? `ORDER #${entityData.id}` : typeKey === 'seller' ? entityData.storeName : entityData.name;
  const handle = typeKey === 'creator' ? entityData.handle :
                 typeKey === 'seller' ? entityData.name :
                 typeKey === 'brand' ? `@brand_${entityData.slug}` :
                 typeKey === 'consumer' ? entityData.email :
                 `Purchased via: ${entityData.platformSource}`;

  const persona = typeKey === 'brand' ? entityData.description : (entityData as any).persona;

  const identityBadges = typeKey === 'creator' ? [
    { label: entityData.verificationStatus },
    { label: entityData.status, colorClass: entityData.status === 'Banned' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20' }
  ] : typeKey === 'consumer' ? [
    { label: entityData.status, colorClass: entityData.status === 'Banned' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20' }
  ] : typeKey === 'seller' ? [
    { label: (entityData as any).verificationStatus, colorClass: 'bg-green-500/10 text-green-400 border border-green-500/20' },
    { label: (entityData as any).applicationStatus, colorClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' }
  ] : typeKey === 'brand' ? [
    { label: entityData.status === 'VERIFIED_OWNER' ? 'Verified Owner' : entityData.status, colorClass: 'bg-green-500/10 text-green-400 border border-green-500/20' }
  ] : [
    { label: entityData.status, colorClass: entityData.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    { label: entityData.paymentStatus, colorClass: entityData.paymentStatus === 'Paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20' }
  ];

  const identityFields = typeKey === 'creator' ? [
    { label: 'Email address', value: entityData.email },
    { label: 'Geography Base', value: entityData.address },
    { label: 'Primary Phone', value: entityData.phone },
    { label: 'Last active timestamp', value: entityData.lastActive, icon: <Clock className="w-3.5 h-3.5 text-app-accent-light" /> }
  ] : typeKey === 'consumer' ? [
    { label: 'Email account', value: entityData.email },
    { label: 'Geography Base', value: entityData.address },
    { label: 'Primary Phone', value: entityData.phone },
    { label: 'Connection Standing', value: entityData.lastActive, icon: <Clock className="w-3.5 h-3.5 text-app-accent-light" /> }
  ] : typeKey === 'seller' ? [
    { label: 'Corporate Email', value: entityData.email },
    { label: 'Contact Phone', value: entityData.phone },
    { label: 'Settlement Plan', value: entityData.settlementPlan },
    { label: 'Corporate Address', value: entityData.address, icon: <MapPin className="w-3.5 h-3.5 text-app-accent-light" /> }
  ] : typeKey === 'brand' ? [
    { label: 'Owner Store Name', value: entityData.ownerStore },
    { label: 'Creative Industry', value: entityData.industry },
    { label: 'Creative Segment', value: entityData.category },
    { label: 'Official Website', value: entityData.websiteUrl, icon: <Globe className="w-3.5 h-3.5 text-app-accent-light" /> }
  ] : [
    { label: 'Cargo Carrier', value: entityData.deliveryPartner },
    { label: 'Buyer Contact', value: entityData.customer.name },
    { label: 'Linked merchant', value: entityData.seller.storeName },
    { label: 'Purchase Date', value: new Date(entityData.timestamp).toLocaleString(), icon: <Calendar className="w-3.5 h-3.5 text-app-accent-light" /> }
  ];

  // specialties tags mapping for Creators
  const tagsTitle = typeKey === 'creator' ? 'Primary Category Tags' : undefined;
  const tags = typeKey === 'creator' ? (entityData as any).specialties : undefined;

  // 5. Timeline Events Logs
  const timelineTitle = typeKey === 'order' ? 'Fulfillment Audit Cargo Logs' : 'Recent Event Trail';
  const timelineEvents = typeKey === 'order' ? entityData.chatHistory.map((item: any, idx: number) => ({
    title: item.sender,
    subtitle: item.text,
    icon: item.sender.includes('Seller') ? <FileText className="w-3.5 h-3.5 text-app-accent-light" /> : <Info className="w-3.5 h-3.5 text-app-accent-light" />
  })) : typeKey === 'brand' ? [
    { title: 'Trademark verified', subtitle: 'June 10, 2026', icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> },
    { title: 'Partner claim approved', subtitle: 'May 28, 2026', icon: <Building2 className="w-3.5 h-3.5 text-app-accent-light" /> }
  ] : (entityData as any).recentActivities?.map((act: any) => ({
    title: act.title,
    subtitle: act.subtitle,
    icon: act.iconType === 'order' ? <Package className="w-3.5 h-3.5 text-app-accent-light" /> : 
          act.iconType === 'chat' ? <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Star className="w-3.5 h-3.5 text-emerald-400" />
  }));

  // 6. Search Bar Buttons
  const searchButtons = typeKey === 'creator' ? [
    {
      label: 'Select Audit Range',
      onClick: () => showToast('Generated campaign audit report', 'success'),
      icon: <Calendar className="w-3.5 h-3.5 text-app-accent" />
    }
  ] : undefined;

  // 7. KPIs Metrics Sections
  const kpis = typeKey === 'consumer' ? [
    { title: 'Total Revenue LTV', value: (entityData as any).totalSpent, subtext: `Last active: ${(entityData as any).lastActive}`, sparklinePath: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20' },
    { title: 'Secure Wallet Standing', value: `${(entityData as any).totalOrders} Invoices`, subtext: `Score: ${(entityData as any).retentionScore}% retention`, colorTheme: 'indigo' as const },
    { title: 'Support & Tickets Log', value: `${(entityData as any).supportTicketsCount} Tickets`, subtext: `Wishlist: ${(entityData as any).wishlistCount} items saved`, colorTheme: entityData.status === 'Banned' ? 'rose' as const : 'emerald' as const }
  ] : typeKey === 'seller' ? [
    { title: 'Total Transacted GTV', value: (entityData as any).revenue, subtext: `Health score: ${(entityData as any).operationalHealth}`, sparklinePath: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20' },
    { title: 'Merchant Trust Score', value: `${(entityData as any).trustScore}% Scale`, subtext: `Fulfillment rate: ${(entityData as any).fulfillmentRate}`, colorTheme: 'indigo' as const },
    { title: 'Active SKU Feed', value: `${(entityData as any).productCount} Catalogs`, subtext: `Orders: ${(entityData as any).ordersCount} volume`, colorTheme: 'emerald' as const }
  ] : typeKey === 'brand' ? [
    { title: 'CMS Profile Complete', value: `${entityData.completionScore}% Rating`, subtext: `Views: ${entityData.pageViews} hits`, sparklinePath: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20' },
    { title: 'In-app Referral Hits', value: `${entityData.referralTraffic} Clicks`, subtext: `Visibility score: ${entityData.searchVisibility}%`, colorTheme: 'indigo' as const },
    { title: 'Ecosystem Partner Badge', value: entityData.badge, subtext: `Connected owner store: ${entityData.ownerStore}`, colorTheme: 'emerald' as const }
  ] : typeKey === 'order' ? [
    { title: 'Buyer Transaction Cost', value: `৳ ${(entityData as any).financials.grandTotal.toLocaleString()}`, subtext: `Platform fee commission: ${(entityData as any).financials.commPercent}%`, sparklinePath: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20' },
    { title: 'Merchant Net Receivable', value: `৳ ${(entityData as any).financials.sellerNet.toLocaleString()}`, subtext: `Commission: ৳ ${(entityData as any).financials.commissionCut.toLocaleString()}`, colorTheme: 'indigo' as const },
    { title: 'Order Status & SLA', value: entityData.status, subtext: `Invoice code: ${(entityData as any).invoiceId}`, colorTheme: 'emerald' as const }
  ] : [
    { title: 'Total Reach & Views', value: (entityData as any).totalViews, subtext: `Followers: ${(entityData as any).followers}`, sparklinePath: 'M5 25 Q 25 10, 45 35 T 85 15 T 95 20' },
    { title: 'Engagement Rate', value: (entityData as any).engagementRate, subtext: `Conversion: ${(entityData as any).conversionRate} avg`, colorTheme: 'indigo' as const },
    { title: 'Brand LTV Generated', value: (entityData as any).revenueGenerated, subtext: `Participation in ${(entityData as any).campaignParticipationCount} Campaigns`, colorTheme: 'emerald' as const }
  ];

  // 8. Tabs Configuration Items
  const tabs = (UPE_CONFIG[typeKey] || []).map(tab => {
    let label = '';
    if (typeKey === 'seller' || typeKey === 'brand') {
      if (tab === 'account') label = '⚙️ Account Information';
      else if (tab === 'verification') label = '🧾 Verification Center';
      else if (tab === 'portfolio') label = '🏬 Brand Portfolio';
      else if (tab === 'products') label = '📦 Product Listings';
      else if (tab === 'orders') label = '📜 Order History';
      else if (tab === 'reviews') label = '🛡️ Reviews & Score';
      else if (tab === 'ads') label = '📢 Ads & Deals';
    } else if (typeKey === 'consumer') {
      if (tab === 'account') label = '⚙️ Account Information';
      else if (tab === 'orders') label = '📜 Order History';
      else if (tab === 'reviews') label = '🛡️ Reviews & Score';
      else if (tab === 'followed_brands') label = '👍🏻 Followed Brands';
      else if (tab === 'saved_items') label = '📌 Saved Items';
      else if (tab === 'followed_creators') label = '🎞 Followed Creators';
      else if (tab === 'search_history') label = '🔍 Search History';
    } else if (typeKey === 'creator') {
      if (tab === 'account') label = '⚙️ Account Information';
      else if (tab === 'verification') label = '🧾 Verification Center';
      else if (tab === 'portfolio') label = '🏬 Creator Portfolio';
      else if (tab === 'recommended_products') label = '📢 Recommended Product Listings';
      else if (tab === 'content_listings') label = '🎞 Recommendations & Guides Listings';
      else if (tab === 'reviews') label = '🛡️ Reviews & Score';
    } else {
      if (tab === 'identity') label = 'Compliance Account Registry';
      else if (tab === 'orders') label = 'Associated Orders Feed';
      else if (tab === 'risk') label = 'Security Risk Analysis & Logs';
      else if (tab === 'activity' || tab === 'timeline') label = 'Security Event Trail Audit';
      else if (tab === 'brands') label = 'Brands Partnership Registry';
      else if (tab === 'products') label = 'Products Catalog Pipeline';
      else if (tab === 'trust') label = 'Trust & Operational Health KPIs';
      else if (tab === 'account') label = 'Creative Brand Properties';
      else if (tab === 'verification') label = 'Creative Registry Verification Check';
      else if (tab === 'portfolio') label = 'Creative Catalogue Portfolio';
      else if (tab === 'ads') label = 'Campaign Promotion Insights';
      else if (tab === 'overview') label = 'Fulfillment Cargo Breakdown';
      else if (tab === 'customer') label = 'Buyer Account Profile';
      else if (tab === 'logistics') label = 'eCourier Tracking Logistics';
      else if (tab === 'finance') label = 'SLA Settlement Ledger';
      else if (tab === 'submissions') label = 'Recommendations Feed';
      else if (tab === 'guides') label = 'Guide Studio (Creator)';
    }
    return { id: tab, label };
  });

  // Risk Checklist
  const riskChecklist = {
    identityScore: '92/100 (Extremely Clean)',
    chargebackRegistry: '0 Records Match',
    ipLocationSync: 'Uttara/Dhanmondi, Dhaka match',
    mobileDeregistrationDevice: 'No device swaps flagged'
  };

  const renderInspectModal = () => {
    if (!selectedGuide) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-app-bg/10 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-app-card border border-app-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-all font-sans">
          
          <div className="p-5 border-b border-app-border flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono text-app-accent px-2 py-0.5 bg-app-accent/5 border border-app-accent/20">
                  AUDIT PANEL
                </span>
                <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono text-white/50">
                  ID: {selectedGuide.id}
                </span>
                {selectedGuide.flaggedByModerator && (
                  <span className="text-[9.5px] uppercase tracking-widest font-bold font-mono bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5">
                    ⚠️ VIOLATION REPORTED
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-app-text-primary leading-tight">
                {selectedGuide.guideTitle}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedGuide(null)}
              className="p-1 px-2.5 rounded-[4px] hover:bg-white/5 border border-transparent hover:border-app-border text-app-text-secondary hover:text-white transition-all cursor-pointer font-bold text-sm"
            >
              ✕ Close
            </button>
          </div>

          <div className="p-6 space-y-6 animate-in fade-in duration-200">
            <div className="bg-white/5 border border-app-border rounded-lg p-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-1.5 font-sans">
                <Star className="w-4 h-4" />
                <span>Real-Time Performance Stats</span>
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-app-bg/10 border border-app-border p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Audience CTR</span>
                  <span className="text-base font-bold text-app-text-primary block mt-0.5">14.8%</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">1.2% vs last mo</span>
                </div>
                <div className="bg-app-bg/10 border border-app-border p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Avg Reading Time</span>
                  <span className="text-base font-bold text-app-text-primary block mt-0.5">3m 48s</span>
                  <span className="text-[8.5px] text-app-text-secondary/50 block font-mono">Target: 4m max</span>
                </div>
                <div className="bg-app-bg/10 border border-app-border p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Total Clickouts</span>
                  <span className="text-base font-bold text-app-text-primary block mt-0.5">1,245 clicks</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">92% Completion</span>
                </div>
                <div className="bg-app-bg/10 border border-app-border p-3.5 rounded-[4px]">
                  <span className="text-[9px] text-app-text-secondary uppercase tracking-wider block">Earnings Influenced</span>
                  <span className="text-base font-bold text-emerald-400 block mt-0.5">৳38,200</span>
                  <span className="text-[8.5px] text-emerald-400 block font-mono">8.4% Comm. split</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-app-border pb-2">
                  CMS Registry Properties
                </h4>
                <div className="space-y-3 font-medium">
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Category Segment:</span>
                    <span className="text-app-text-primary font-bold">{selectedGuide.category}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Target Audience:</span>
                    <span className="text-app-text-primary">{selectedGuide.audienceType}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Read Time Estimate:</span>
                    <span className="text-app-text-primary font-mono">{selectedGuide.readTime}</span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-app-text-secondary">Winner Champion:</span>
                    <span className="text-emerald-400 font-bold">{selectedGuide.winnerProduct || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/80 border-b border-app-border pb-2">
                  Audit Verification Trail
                </h4>
                <div className="space-y-3.5">
                  <div className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5" />
                    <div>
                      <span className="text-xs font-bold text-app-text-primary block">Published Live State Verified</span>
                      <span className="text-[10px] text-app-text-secondary font-mono block mt-0.5">14 June, 2026 | 02:44 pm by automated sync agent</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-app-border pt-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-app-accent-light block font-mono">
                  MODERATOR CONTROL OVERRIDES
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                <div className="bg-app-bg/10 p-4 rounded-lg border border-app-border space-y-2">
                  <label className="text-[10px] font-bold text-app-text-primary uppercase tracking-wider block">Publications Standing</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Live', 'Draft', 'Archived'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => {
                          const updated = { ...selectedGuide, status: st };
                          setSelectedGuide(updated);
                        }}
                        className={`px-1 py-1 rounded-[3px] text-[10px] font-bold cursor-pointer transition-colors border leading-[14px]${
                          selectedGuide.status === st 
                            ? "bg-app-accent border-app-accent text-white" 
                            : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-app-bg/10 p-4 rounded-lg border border-app-border flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-app-text-primary uppercase tracking-wider block">Content Flag & Quarantine</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...selectedGuide, flaggedByModerator: !selectedGuide.flaggedByModerator };
                      setSelectedGuide(updated);
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-[10px] font-bold border transition-colors mt-2 cursor-pointer${
                      selectedGuide.flaggedByModerator
                        ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                        : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {selectedGuide.flaggedByModerator ? '⚠️ Remove Flag' : '☠️ Flag for Moderation Review'}
                  </button>
                </div>

                <div className="bg-app-bg/10 p-4 rounded-lg border border-app-border flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-app-text-primary uppercase tracking-wider block">Expert Badge Verification</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...selectedGuide, verifiedContributor: !selectedGuide.verifiedContributor };
                      setSelectedGuide(updated);
                    }}
                    className={`px-3 py-1.5 rounded-[4px] text-[10px] font-bold border transition-colors mt-2 cursor-pointer${
                      selectedGuide.verifiedContributor
                        ? "bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-400/30"
                        : "bg-white/5 border-white/10 text-app-text-secondary hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {selectedGuide.verifiedContributor ? '✓ Revoke Verification' : '★ Approve Contributor'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-app-border bg-app-bg/10 flex items-center justify-between font-mono">
            <span className="text-[10px] text-app-text-secondary opacity-60">
              Double-check rules before committing alterations.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-4 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-secondary hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Cancel Override
              </button>
              <button
                onClick={() => handleSaveModeration(selectedGuide.id, {
                  status: selectedGuide.status,
                  flaggedByModerator: selectedGuide.flaggedByModerator,
                  verifiedContributor: selectedGuide.verifiedContributor
                })}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-light rounded-[4px] text-xs font-bold text-app-text-primary cursor-pointer shadow-md"
              >
                Save Sync Overrides
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Contacts integration
  const onPhoneClick = () => {
    triggerPhone({
      id: entityData.id,
      name: typeKey === 'order' ? entityData.customer.name : entityData.name,
      phone: (entityData as any).phone || '+880 1711-223344',
      avatarUrl: (entityData as any).avatarUrl || '',
      status: (entityData as any).status || 'Active',
      role: typeKey.toUpperCase()
    });
    showToast(`🔄 Connecting phone call routing...`, 'info');
  };

  const onMessageClick = () => {
    triggerMessage({
      id: entityData.id,
      name: typeKey === 'order' ? entityData.customer.name : entityData.name,
      phone: (entityData as any).phone || '+880 1711-223344',
      avatarUrl: (entityData as any).avatarUrl || '',
      status: (entityData as any).status || 'Active',
      role: typeKey.toUpperCase()
    });
    showToast(`💬 Initiated contact message box sync`, 'success');
  };

  return (
    <div className="relative">
      <ProfileLayout
        breadcrumbs={breadcrumbs}
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
        backLink={backLink}
        backLinkLabel={backLinkLabel}
        bannerText={bannerText}
        bannerGradientClass={bannerGradientClass}
        avatarUrl={avatarUrl}
        initials={initials}
        name={name}
        handle={handle}
        persona={persona}
        identityBadges={identityBadges}
        identityFields={identityFields}
        onPhoneClick={onPhoneClick}
        onMessageClick={onMessageClick}
        tagsTitle={tagsTitle}
        tags={tags}
        timelineTitle={timelineTitle}
        timelineEvents={timelineEvents}
        searchPlaceholder={typeKey === 'creator' ? 'Search recommendations or campaigns...' : 'Search records...'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchButtons={searchButtons}
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        toast={toast ? { message: toast.text, type: toast.type } : null}
      >
        
        {/* ========================================== */}
        {/* REVISED WORKSPACE TABS FOR CONSUMERS       */}
        {/* ========================================== */}

        {/* TAB 1: ⚙️ Account Information */}
        {activeTab === 'account' && typeKey === 'consumer' && entityData && (
          <div className="space-y-6 text-left font-sans">
            {/* Billing & Shipping Addresses (Editable Mocks) */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Associated Delivery Addresses</h3>
                <p className="text-[11px] text-app-text-secondary mt-1 font-sans">Physical shipping address endpoints registered for cargo dispatch pipelines.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
                <div className="bg-[#050512] border border-app-border p-5 rounded-[4px] relative group">
                  <span className="px-1.5 py-0.5 bg-[#F4631E]/10 text-[#F4631E] rounded-[2px] text-[8px] font-black uppercase tracking-widest absolute top-4 right-4">Default</span>
                  <div className="space-y-2">
                    <span className="text-[9px] text-app-text-secondary uppercase block font-bold">Default Shipping</span>
                    <textarea 
                      value={defaultShippingAddress} 
                      onChange={(e) => setDefaultShippingAddress(e.target.value)}
                      className="text-xs text-app-text-primary font-semibold bg-transparent border-0 focus:ring-0 p-0 resize-none w-full h-16 block mt-1 scrollbar-hide focus:outline-none"
                    />
                  </div>
                  <button onClick={() => showToast('✓ Default shipping address saved locally')} className="mt-2 text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer block">Save Changes</button>
                </div>

                <div className="bg-white/5 border border-app-border p-5 rounded-[4px] relative">
                  <div className="space-y-2">
                    <span className="text-[9px] text-app-text-secondary uppercase block font-bold">Alternative Shipping</span>
                    <textarea 
                      value={shippingAddress} 
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="text-xs text-app-text-primary font-semibold bg-transparent border-0 focus:ring-0 p-0 resize-none w-full h-16 block mt-1 scrollbar-hide focus:outline-none"
                    />
                  </div>
                  <button onClick={() => showToast('✓ Alternative shipping address saved locally')} className="mt-2 text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer block">Save Changes</button>
                </div>

                <div className="bg-white/5 border border-app-border p-5 rounded-[4px] relative">
                  <div className="space-y-2">
                    <span className="text-[9px] text-app-text-secondary uppercase block font-bold">Billing Address</span>
                    <textarea 
                      value={billingAddress} 
                      onChange={(e) => setBillingAddress(e.target.value)}
                      className="text-xs text-app-text-primary font-semibold bg-transparent border-0 focus:ring-0 p-0 resize-none w-full h-16 block mt-1 scrollbar-hide focus:outline-none"
                    />
                  </div>
                  <button onClick={() => showToast('✓ Billing address saved locally')} className="mt-2 text-[10px] text-indigo-400 font-bold hover:underline cursor-pointer block">Save Changes</button>
                </div>
              </div>
            </div>

            {/* Login Activity, Connected Accounts, Privacy Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
              
              {/* Access Settings & Notification Settings */}
              <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-4 text-left">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider border-b border-app-border pb-2">Communication & Security</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-app-text-secondary">Email Notifications</span>
                    <button 
                      onClick={() => {
                        setCommunicationPref(p => ({ ...p, email: !p.email }));
                        showToast(`✓ Email notifications ${!communicationPref.email ? 'enabled' : 'disabled'}`);
                      }}
                      className={`w-10 h-5.5 rounded-full p-1 transition-colors cursor-pointer${communicationPref.email ? 'bg-[#F4631E]' : 'bg-white/10'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform${communicationPref.email ? 'translate-x-4.5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-app-text-secondary">SMS Alerts & Broadcasts</span>
                    <button 
                      onClick={() => {
                        setCommunicationPref(p => ({ ...p, sms: !p.sms }));
                        showToast(`✓ SMS alerts ${!communicationPref.sms ? 'enabled' : 'disabled'}`);
                      }}
                      className={`w-10 h-5.5 rounded-full p-1 transition-colors cursor-pointer${communicationPref.sms ? 'bg-[#F4631E]' : 'bg-white/10'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform${communicationPref.sms ? 'translate-x-4.5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-app-text-secondary">Two-Factor Auth (2FA)</span>
                    <button 
                      onClick={() => {
                        setCommunicationPref(p => ({ ...p, push: !p.push }));
                        showToast(`✓ Two-factor authentication status updated`);
                      }}
                      className={`w-10 h-5.5 rounded-full p-1 transition-colors cursor-pointer${communicationPref.push ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform${communicationPref.push ? 'translate-x-4.5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-app-border space-y-2">
                  <button onClick={() => showToast('✓ Reset password link dispatched to client email address')} className="w-full py-2 bg-white/5 hover:bg-white/10 text-app-text-primary font-bold text-xs rounded transition-colors text-center cursor-pointer">
                    Trigger Password Reset
                  </button>
                </div>
              </div>

              {/* Connected Accounts */}
              <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-4 text-left">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider border-b border-app-border pb-2">Connected Accounts</h4>
                <div className="space-y-3 text-xs font-sans">
                  <div className="flex items-center justify-between p-2.5 bg-white/5 border border-app-border rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-app-text-secondary font-bold">Google Auth ID</span>
                    </div>
                    <span className="text-[10px] text-app-text-secondary font-mono">FR-995201-99</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white/5 border border-app-border rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      <span className="text-app-text-secondary">Facebook Connect</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase font-mono">Not Linked</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white/5 border border-app-border rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-app-text-secondary font-bold">Github OAuth</span>
                    </div>
                    <span className="text-[10px] text-app-text-secondary font-mono">farhan-bin-rafiq</span>
                  </div>
                </div>
              </div>

              {/* Login Security Trail */}
              <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-4 text-left">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider border-b border-app-border pb-2">Active Sessions Security Trail</h4>
                
                <div className="space-y-2.5 font-sans text-xs">
                  <div className="p-3 bg-white/5 border border-app-border rounded relative">
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-[2px] text-[8px] font-bold uppercase absolute top-2 right-2">Current</span>
                    <span className="text-[11px] font-bold text-app-text-primary block">Dhaka, Bangladesh</span>
                    <span className="text-[10px] text-app-text-secondary block mt-0.5">Chrome/Windows • Today at 10:24 AM</span>
                  </div>

                  <div className="p-3 bg-white/5 border border-app-border rounded">
                    <span className="text-[11px] font-bold text-app-text-primary block">Chittagong, Bangladesh</span>
                    <span className="text-[10px] text-app-text-secondary block mt-0.5">Safari/iOS • 2 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'identity' && typeKey === 'seller' && (
          <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
            <div className="border-b border-app-border pb-3">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider text-app-accent-light">NBR Business Registry Verification Documents</h3>
              <p className="text-[11px] text-app-text-secondary mt-1">Merchant registered enterprise records and tax certificates of compliance.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                <span className="text-[9.5px] font-bold text-emerald-400 block uppercase tracking-widest font-sans">Trade License Registration</span>
                <span className="text-app-text-primary block font-black">{(entityData as any).legalId}</span>
                <span className="text-[9px] text-app-text-secondary uppercase">Status: ACTIVE SLA</span>
              </div>
              <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                <span className="text-[9.5px] font-bold text-indigo-400 block uppercase tracking-widest font-sans">Tax Certificate (TIN)</span>
                <span className="text-app-text-primary block font-black">{(entityData as any).tin}</span>
                <span className="text-[9px] text-app-text-secondary uppercase">Status: APPROVED TAXPAYER</span>
              </div>
              <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                <span className="text-[9.5px] font-bold text-violet-400 block uppercase tracking-widest font-sans">VAT Business Identification (BIN)</span>
                <span className="text-app-text-primary block font-black">{(entityData as any).bin}</span>
                <span className="text-[9px] text-app-text-secondary uppercase">Status: VERIFIED 2026</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 📜 Order History */}
        {activeTab === 'orders' && typeKey === 'consumer' && entityData && (
          <div className="space-y-6 text-left font-sans">
            <div className="bg-app-card border border-app-border rounded-[4px] p-2.5 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(['All', 'Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Returned', 'Exchanged'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setOrderStatusFilter(status);
                    showToast(`✓ Switched order filter: ${status}`);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-[2px] transition-all cursor-pointer whitespace-nowrap${
                    orderStatusFilter === status
                      ? 'bg-[#F4631E] text-white shadow font-sans'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 font-sans'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <ContentTable 
              title={`${orderStatusFilter} Associated Orders Feed Log`} 
              headers={['Order ID', 'Category & Product', 'Quantity', 'Bill Status', 'Carrier Status', 'Subtotal', 'SLA Actions']}
            >
              {[
                { id: '1081', product: { name: 'Summer Cotton Silk Saree', brand: 'Aarong Fabric House' }, quantity: 2, paymentStatus: 'Paid', carrierStatus: 'Processing', price: 4200, status: 'Processing' },
                { id: '1082', product: { name: 'Monsoon Pure Nakshi Kantha Saree', brand: 'Aarong Fabric House' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Delivered', price: 12500, status: 'Delivered' },
                { id: '1083', product: { name: 'Eid Premium Panjabi Collection', brand: 'Jamdani Royal Heritage' }, quantity: 3, paymentStatus: 'Paid', carrierStatus: 'In Transit', price: 3800, status: 'In Transit' },
                { id: '1084', product: { name: 'Traditional Tangail Handloom Saree', brand: 'Aarong Fabric House' }, quantity: 1, paymentStatus: 'Unpaid', carrierStatus: 'Pending', price: 4500, status: 'Pending' },
                { id: '1085', product: { name: 'Synthetic Georgette Kurti', brand: 'Jamdani Royal Heritage' }, quantity: 1, paymentStatus: 'Refunded', carrierStatus: 'Cancelled', price: 2100, status: 'Cancelled' },
                { id: '1086', product: { name: 'Muslin Silk Exquisite Jamdani Saree', brand: 'Jamdani Royal Heritage' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Returned', price: 25000, status: 'Returned' },
                { id: '1087', product: { name: 'Exquisite Jamdani Fabric Saree', brand: 'Aarong Fabric House' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Exchanged', price: 15000, status: 'Exchanged' },
                { id: '1088', product: { name: 'Muslin Silk Saree', brand: 'Jamdani Royal Heritage' }, quantity: 2, paymentStatus: 'Paid', carrierStatus: 'Dispatched', price: 22000, status: 'Dispatched' },
                { id: '1089', product: { name: 'Traditional Hand-carved Sarcophagus Box', brand: 'Jamdani Royal Heritage' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Confirmed', price: 4500, status: 'Confirmed' }
              ]
                .filter(o => {
                  if (orderStatusFilter === 'All') return true;
                  return o.status === orderStatusFilter;
                })
                .map((ord: any) => (
                  <div key={ord.id} className="grid grid-cols-12 gap-4 py-3.5 items-center hover:bg-white/5 transition-colors border-b border-app-border px-2 font-sans">
                    <div className="col-span-12 md:col-span-2">
                      <Link to={`/upe/order/${ord.id}`} className="text-xs font-bold text-[#F4631E] hover:underline font-mono">
                        #{ord.id}
                      </Link>
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <Link to={`/products/${getMockProductId(ord.product.name)}`} className="text-xs text-app-text-primary font-bold block truncate hover:underline hover:text-app-accent transition-colors">
                        {ord.product.name}
                      </Link>
                      <span className="text-[10px] text-app-text-secondary font-semibold font-mono block mt-0.5">Brand: {ord.product.brand}</span>
                    </div>
                    <div className="col-span-4 md:col-span-1 text-center">
                      <span className="text-xs text-app-text-secondary">{ord.quantity} items</span>
                    </div>
                    <div className="col-span-4 md:col-span-1.5">
                      <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-widest border font-mono inline-block${
                        ord.paymentStatus === 'Paid' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        ord.paymentStatus === 'Unpaid' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </div>
                    <div className="col-span-4 md:col-span-1.5">
                      <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-widest border font-mono inline-block${
                        ord.carrierStatus === 'Delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        ord.carrierStatus === 'Cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {ord.carrierStatus}
                      </span>
                    </div>
                    <div className="col-span-6 md:col-span-1.5 text-right font-mono text-xs font-bold text-app-text-primary px-2">
                      ৳{(ord.price * ord.quantity).toLocaleString()}
                    </div>
                    <div className="col-span-6 md:col-span-1 flex justify-end gap-1 px-1.5">
                      <button 
                        onClick={() => showToast(`Opening order #${ord.id}`)}
                        className="p-1 text-app-text-secondary hover:text-white cursor-pointer transition-colors"
                        title="View Order"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => showToast(`✓ Dispensing invoice PDF for Order #${ord.id}`)}
                        className="p-1 text-app-text-secondary hover:text-emerald-400 cursor-pointer transition-colors"
                        title="View Invoice"
                      >
                        <FileCheck className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => showToast(`✓ Loading Seller Profile endpoint for direct sync`)}
                        className="p-1 text-app-text-secondary hover:text-indigo-400 cursor-pointer transition-colors"
                        title="View Seller"
                      >
                        <User className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </ContentTable>
          </div>
        )}

        {/* TAB 3: 🛡️ Reviews & Score */}
        {activeTab === 'reviews' && typeKey === 'consumer' && (
          <div className="space-y-6 text-left font-sans animate-fade-in">
            {/* Consumer Metrics & Customer Trust Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Trust Score Card */}
              <div className="bg-[#050512] border border-app-border p-6 rounded-[4px] relative shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] text-app-text-secondary uppercase block font-semibold">Reputation & Loyalty</span>
                    <h4 className="text-xl font-bold text-app-text-primary mt-1">SLA Trust Rating</h4>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[2px] text-[9px] font-bold uppercase font-mono">Clean Tier 1</span>
                </div>
                
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Average Rating Given</span>
                    <span className="text-app-text-primary font-bold font-mono">4.8 / 5.0</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Total Helpful Votes</span>
                    <span className="text-app-text-primary font-bold font-mono">42 Votes</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Review Approval Rate</span>
                    <span className="text-emerald-400 font-bold font-mono">100.0%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Removed Reviews</span>
                    <span className="text-app-text-secondary font-mono">0 Flags</span>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger stats */}
              <div className="bg-app-card border border-app-border p-6 rounded-[4px] shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] text-app-text-secondary uppercase block font-semibold">Fulfillment Reliability</span>
                    <h4 className="text-xl font-bold text-app-text-primary mt-1">Trust Score</h4>
                  </div>
                  <span className="text-lg font-mono font-black text-emerald-400">98 / 100</span>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Successful Orders</span>
                    <span className="text-app-text-primary font-bold font-mono">18 Completed</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Return Rate</span>
                    <span className="text-indigo-400 font-bold font-mono">3.4% MTD</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Cancellation Rate</span>
                    <span className="text-rose-400 font-bold font-mono">1.2%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-text-secondary">Active Dispute Rate</span>
                    <span className="text-app-text-secondary font-mono">0.0%</span>
                  </div>
                </div>
              </div>

              {/* Fraud Risks signals */}
              <div className="bg-app-card border border-app-border p-6 rounded-[4px] shadow-xl">
                <div className="mb-4">
                  <span className="text-[10px] text-app-text-secondary uppercase block font-semibold">System Diagnostics</span>
                  <h4 className="text-xl font-bold text-app-text-primary mt-1">Security Audit</h4>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-text-secondary">IP Location Sync Ratio</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-[2px] text-[10px] font-bold uppercase font-mono font-sans">MATCHED</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-text-secondary">Chargeback Registry Index</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-[2px] text-[10px] font-bold uppercase font-mono font-sans">0 FLAGS</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-text-secondary">Rapid Multi-device Drops</span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-[2px] text-[10px] font-bold uppercase font-mono font-sans font-sans">CLEAN</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-text-secondary">Loyalty Level</span>
                    <span className="text-[#F4631E] font-black font-sans uppercase">VIP Tier</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Submitted Reviews List */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Submitted Product & Brand Reviews</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Verified user rating allocations disbursed across the platform.</p>
                </div>
                
                <div className="flex gap-1.5">
                  {(['All', 'Product', 'Brand', 'Creator'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedReviewFilter(f)}
                      className={`px-3 py-1 text-[10px] font-bold border rounded-[2px] transition-colors cursor-pointer${
                        selectedReviewFilter === f ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {f} Feedbacks
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { id: '1', type: 'Product', entityName: 'Exquisite Hand-woven Jamdani Silk Saree', rating: 5, comment: 'Exceptional texture quality. The handloom geometric alignments are pristine and represent exquisite heritage craftsmanship.', date: 'Today at 09:12 AM' },
                  { id: '2', type: 'Brand', entityName: 'Aarong Fabric House', rating: 5, comment: 'Professional customer outreach and lightning fast shipping courier coordination in Dhaka Uttara sectors.', date: '3 days ago' },
                  { id: '3', type: 'Creator', entityName: 'Rifat Hasan', rating: 4, comment: 'Extremely detailed authenticity review of standard silk versus natural muslin styles.', date: '12 May, 2026' },
                  { id: '4', type: 'Product', entityName: 'Summer Cotton Silk Saree', rating: 5, comment: 'Highly comfortable daily wear drape, perfectly matching the catalog item descriptors!', date: '14 May, 2026' }
                ]
                  .filter(r => selectedReviewFilter === 'All' ? true : r.type === selectedReviewFilter)
                  .map(rev => (
                    <div key={rev.id} className="p-4 bg-white/5 border border-app-border rounded flex flex-col gap-3 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-[2px] text-[8px] font-bold uppercase tracking-widest font-mono inline-block mb-1">{rev.type} Review</span>
                          <h4 className="text-xs font-bold text-app-text-primary block">{rev.entityName}</h4>
                        </div>
                        <span className="text-[10px] text-app-text-secondary font-mono">{rev.date}</span>
                      </div>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                        ))}
                      </div>

                      <p className="text-xs text-app-text-secondary font-sans italic leading-relaxed font-semibold">"{rev.comment}"</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 👍🏻 Followed Brands */}
        {activeTab === 'followed_brands' && typeKey === 'consumer' && (
          <div className="space-y-6 text-left font-sans">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl">
              <div className="border-b border-app-border pb-3 mb-6">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Followed Handcraft Brands</h3>
                <p className="text-[11px] text-app-text-secondary mt-1 font-sans">Monitored merchant suppliers and physical store channels followed by the consumer.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {consumerFollowedBrands.map(b => (
                  <div key={b.id} className="bg-[#050512] border border-app-border p-5 rounded-[4px] shadow-xl flex flex-col justify-between transition-all hover:border-white/[0.08] relative group">
                    <span className="text-[8px] text-app-text-secondary uppercase font-bold absolute top-4 right-4">Followed {b.followDate}</span>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[2px] bg-app-bg overflow-hidden border border-app-border shrink-0">
                          <img referrerPolicy="no-referrer" src={b.logo} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-app-text-primary">{b.name}</span>
                            {b.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <span className="text-[10px] text-app-text-secondary font-semibold font-mono block mt-0.5">{b.category}</span>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-app-border p-3 rounded-[2px]">
                        <span className="text-[8.5px] uppercase font-bold text-[#F4631E] block font-mono">Latest Activity Update</span>
                        <p className="text-[11px] text-app-text-secondary mt-1 leading-snug">{b.lastActivity}</p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-app-border flex gap-2">
                      <button 
                        onClick={() => showToast(`✓ Loading verified profile for: ${b.name}`)}
                        className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-app-text-primary font-bold text-[10px] rounded-[2px] text-center cursor-pointer transition-colors"
                      >
                        View Brand Profile
                      </button>
                      <button 
                        onClick={() => showToast(`✓ Direct sync messenger chat initialized for followed brand: ${b.name}`)}
                        className="py-1.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 rounded-[2px] cursor-pointer transition-colors"
                        title="Send Direct Message"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 📌 Saved Items */}
        {activeTab === 'saved_items' && typeKey === 'consumer' && (
          <div className="space-y-6 text-left font-sans">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl">
              <div className="border-b border-app-border pb-3 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Saved & Bookmarked Catalogs</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Consumer bookmarked items, promotions, and active discount campaigns.</p>
                </div>
                
                <button 
                  onClick={() => showToast('✓ Cleaned up expired bookmark codes')}
                  className="px-3 py-1.5 bg-white/5 border border-app-border text-xs font-bold font-sans text-app-text-secondary hover:text-white rounded-[2px] transition-colors cursor-pointer"
                >
                  Verify All Saved Availability
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                {consumerSavedItems.map(item => (
                  <div key={item.id} className="bg-app-bg/10 border border-app-border rounded-[4px] overflow-hidden flex flex-col justify-between transition-all hover:border-white/[0.08]">
                    
                    <div className="relative aspect-square w-full bg-app-card border-b border-app-border overflow-hidden">
                      <img referrerPolicy="no-referrer" src={item.image} alt="" className="w-full h-full object-cover" />
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-app-bg/10 backdrop-blur-md rounded-[2px] text-[8px] font-bold uppercase tracking-wider text-app-text-secondary border border-app-border">
                        {item.type}
                      </span>
                    </div>

                    <div className="p-4 space-y-2 text-left">
                      <span className="text-[9.5px] font-bold text-app-text-secondary uppercase block font-mono">{item.brand}</span>
                      <h4 className="text-xs font-bold text-app-text-primary block truncate leading-tight">{item.name}</h4>
                      
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-extrabold text-[#F4631E] font-mono">৳{item.price.toLocaleString()}</span>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-[2px] text-[8px] font-mono font-bold">
                          {item.availability}
                        </span>
                      </div>
                      
                      <span className="text-[9px] text-slate-500 block font-sans pt-1">Saved on {item.saveDate}</span>
                    </div>

                    <div className="px-4 pb-4 pt-1 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button 
                          onClick={() => showToast(`Redirecting to catalog: ${item.name}`)}
                          className="py-1.5 bg-white/5 hover:bg-white/10 text-app-text-primary font-bold text-[9px] rounded-[2px] transition-colors cursor-pointer text-center font-sans"
                        >
                          View Item
                        </button>
                        <button 
                          onClick={() => {
                            setConsumerSavedItems(prev => prev.filter(i => i.id !== item.id));
                            showToast(`✗ Removed ${item.name} from saved items`);
                          }}
                          className="py-1.5 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold text-[9px] rounded-[2px] transition-colors cursor-pointer text-center font-sans"
                        >
                          Remove
                        </button>
                      </div>
                      <button 
                        onClick={() => showToast(`✓ Added ${item.name} to logistics client allocation list`)}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9.5px] rounded-[2px] transition-colors cursor-pointer text-center uppercase tracking-widest font-sans"
                      >
                        Add to Cart Link
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: 🎞 Followed Creators */}
        {activeTab === 'followed_creators' && typeKey === 'consumer' && (
          <div className="space-y-6 text-left font-sans">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl">
              <div className="border-b border-app-border pb-3 mb-6">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Followed Heritage Creators</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Creative ambassadors, authentic handloom advocates, and textile bloggers.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                {consumerFollowedCreators.map(creator => (
                  <div key={creator.id} className="bg-[#050512] border border-app-border p-5 rounded-[4px] flex flex-col justify-between transition-all hover:border-white/[0.08] shadow-lg">
                    
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-app-border shrink-0 bg-app-bg">
                        <img referrerPolicy="no-referrer" src={creator.avatarUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="space-y-1 bg-transparent flex-1 text-left">
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <h4 className="text-xs font-bold text-app-text-primary leading-none">{creator.name}</h4>
                          {creator.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-[#00D4B2] font-semibold tracking-wide font-sans">{creator.specialty}</span>
                        <span className="text-[9.5px] text-app-text-secondary block font-sans">Reach: <strong className="text-app-text-secondary">{creator.followers} followers</strong></span>
                      </div>
                    </div>

                    <div className="bg-white/5 border border-app-border rounded-[4px] p-3 mt-4 text-xs font-sans text-left">
                      <span className="text-[9px] uppercase font-bold text-[#F4631E] tracking-wider block font-mono">Latest Published Content Guide</span>
                      <p className="text-app-text-secondary font-medium leading-relaxed mt-1">"{creator.latestContent}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-app-border">
                      <button 
                        onClick={() => showToast(`Redirecting sandbox to creator profile: ${creator.name}`)}
                        className="py-1.5 bg-white/5 hover:bg-white/10 text-app-text-primary font-bold text-[10px] rounded-[2px] transition-colors cursor-pointer text-center font-sans"
                      >
                        View Creator Profile
                      </button>
                      <button 
                        onClick={() => showToast(`✓ Loading recent creative blog entries for ${creator.name}`)}
                        className="py-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 font-bold text-[10px] rounded-[2px] transition-colors cursor-pointer text-center font-sans"
                      >
                        View Latest Content
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: 🔍 Search History */}
        {activeTab === 'search_history' && typeKey === 'consumer' && (
          <div className="space-y-6 text-left font-sans animate-fade-in">
            {/* Search History Analytics Widget Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#050512] border border-app-border p-5 rounded-[4px] shadow-xl">
                <span className="text-[9.5px] text-app-text-secondary uppercase block font-bold">Frequent Category</span>
                <span className="text-base font-extrabold text-app-text-primary block mt-1">Silk & Premium Sarees</span>
                <span className="text-[9.5px] text-emerald-400 block mt-1 font-mono font-bold">42 Search Entries MTD</span>
              </div>
              
              <div className="bg-app-card border border-app-border p-5 rounded-[4px] shadow-xl">
                <span className="text-[9.5px] text-app-text-secondary uppercase block font-bold">Top Keyword Query</span>
                <span className="text-base font-extrabold text-app-text-primary block mt-1">Traditional Jamdani Saree</span>
                <span className="text-[9.5px] text-indigo-400 block mt-1 font-mono font-bold">14 Unique Sessions</span>
              </div>

              <div className="bg-app-card border border-app-border p-5 rounded-[4px] shadow-xl">
                <span className="text-[9.5px] text-app-text-secondary uppercase block font-bold">Search Frequency Timeline</span>
                <span className="text-base font-extrabold text-app-text-primary block mt-1">High Intensity</span>
                <span className="text-[9.5px] text-app-text-secondary block mt-1 font-sans">Daily trace spikes noted between 8PM-11PM</span>
              </div>
            </div>

            {/* Keyword log table list */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Search History Log Trace</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Administrative audit trails tracking catalog matching search intents.</p>
                </div>

                <button 
                  onClick={() => {
                    setConsumerSearchHistory([]);
                    showToast('✓ Successfully cleared entire consumer search history registry database logs.');
                  }}
                  className="px-3.5 py-1.5 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-[2px] transition-colors cursor-pointer font-sans"
                >
                  Clear Entire History (Admin)
                </button>
              </div>

              {consumerSearchHistory.length > 0 ? (
                <div className="overflow-x-auto rounded border border-app-border bg-app-bg/10 text-xs text-left">
                  <table className="min-w-full divide-y divide-white/5 font-sans">
                    <thead>
                      <tr className="bg-app-bg text-[10px] text-app-text-secondary uppercase text-left font-sans font-bold">
                        <th className="px-4 py-3">Keyword Query</th>
                        <th className="px-4 py-3">Category Target</th>
                        <th className="px-4 py-3">Timestamp GTM+6</th>
                        <th className="px-4 py-3 text-center">Results Returned</th>
                        <th className="px-4 py-3">Detection Device</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.01] text-app-text-secondary">
                      {consumerSearchHistory.map((search) => (
                        <tr key={search.id} className="hover:bg-white/[0.01] transition-colors font-sans font-medium text-xs">
                          <td className="px-4 py-3 text-app-text-primary font-black">{search.keyword}</td>
                          <td className="px-4 py-3 font-semibold text-indigo-400">{search.category}</td>
                          <td className="px-4 py-3 text-app-text-secondary">{search.time}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono font-bold border${search.results > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border-rose-500/15'}`}>
                              {search.results} items
                            </span>
                          </td>
                          <td className="px-4 py-3 text-app-text-secondary">{search.device}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button 
                                onClick={() => showToast(`✓ Opening search details log for keyword: "${search.keyword}"`)}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-app-text-secondary hover:text-white rounded-[2px] text-[10px] font-bold cursor-pointer font-sans"
                              >
                                View Details
                              </button>
                              <button 
                                onClick={() => {
                                  setConsumerSearchHistory(prev => prev.filter(s => s.id !== search.id));
                                  showToast(`✓ Cleared search entry: "${search.keyword}"`);
                                }}
                                className="px-2.5 py-1 bg-rose-600/5 hover:bg-rose-600/15 text-rose-400 rounded-[2px] text-[10px] font-bold cursor-pointer font-sans"
                              >
                                Clear
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-app-text-secondary font-semibold text-xs border border-app-border rounded">
                  All platform search history logs have been destroyed or cleared.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Module D: Timeline Activities for Orders */}
        {activeTab === 'timeline' && typeKey === 'order' && (
          <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6 text-left">
            <div className="border-b border-app-border pb-3">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Ecosystem Active Conversation Wire</h3>
              <p className="text-[11px] text-app-text-secondary mt-1">Audit log traces and messaging syncing conduits.</p>
            </div>
            <div className="space-y-4 font-sans text-xs">
              {((entityData as any).chatHistory || []).map((chat: any, idx: number) => (
                <div key={idx} className="p-3 bg-white/5 border border-app-border rounded text-app-text-secondary">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[#F4631E]">{chat.sender}</span>
                    <span className="text-[9.5px] text-app-text-secondary">{chat.time}</span>
                  </div>
                  <p className="text-app-text-secondary mt-1 leading-relaxed">{chat.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChatMessage} className="space-y-3 pt-4 border-t border-app-border">
              <textarea 
                value={chatMessageText}
                onChange={(e) => setChatMessageText(e.target.value)}
                placeholder="Draft system sync message..."
                className="w-full p-2.5 bg-white/5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-accent focus:outline-none"
                rows={2}
              />
              <button type="submit" className="px-4 py-2 bg-app-accent hover:bg-app-accent-light text-app-text-primary text-xs font-bold rounded cursor-pointer shadow">
                Push message
              </button>
            </form>
          </div>
        )}

        {/* Module E: Brands Partnership Registry for Sellers */}
        {activeTab === 'brands' && typeKey !== 'seller' && typeKey !== 'brand' && (
          <ContentTable 
            title="Brands Partnership Registry & Commissions" 
            headers={['ID', 'Brand Name', 'Commission Split', 'Connection status']}
          >
            {((entityData as any).brands || []).map((b: any) => (
              <div key={b.id} className="grid grid-cols-12 gap-4 py-3.5 items-center hover:bg-white/5 transition-all border-b border-app-border px-2">
                <div className="col-span-2 font-mono text-xs text-app-accent-light font-bold">{b.id}</div>
                <div className="col-span-4 text-xs font-bold text-app-text-primary">{b.name}</div>
                <div className="col-span-3 text-xs font-semibold text-emerald-400 font-mono">{b.commissionCut} Split</div>
                <div className="col-span-3 text-right">
                  <span className="inline-block px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 uppercase font-mono">
                    {b.status === 'VERIFIED_OWNER' ? 'VERIFIED OWNER' : b.status}
                  </span>
                </div>
              </div>
            ))}
          </ContentTable>
        )}

        {/* Module F: Product catalog items pipeline */}
        {activeTab === 'products' && typeKey !== 'seller' && typeKey !== 'brand' && (
          <ContentTable 
            title="Active Products Catalog List Pipeline" 
            headers={['ID', 'Product Title', 'Active Retail Price', 'SLA Stocks Status', 'Status']}
          >
            {[
              { id: 'p101', title: 'Summer Cotton Silk Saree', price: '৳ 4,200', stock: '24 Available', status: 'Live' },
              { id: 'p102', title: 'Monsoon Pure Nakshi Kantha Saree', price: '৳ 12,500', stock: '8 Available', status: 'Live' }
            ].map(prod => (
              <div key={prod.id} className="grid grid-cols-12 gap-4 py-3.5 items-center hover:bg-white/5 transition-all border-b border-app-border px-2 font-sans">
                <div className="col-span-2 text-xs font-mono text-app-text-secondary">{prod.id}</div>
                <div className="col-span-4 text-xs font-bold text-app-text-primary">
                  <Link to={`/products/${getMockProductId(prod.title)}`} className="hover:underline hover:text-app-accent transition-colors">
                    {prod.title}
                  </Link>
                </div>
                <div className="col-span-2 text-xs font-bold text-app-text-primary font-mono">{prod.price}</div>
                <div className="col-span-2 text-xs text-app-text-secondary font-mono">{prod.stock}</div>
                <div className="col-span-2 text-right">
                  <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-green-500/10 text-green-400 text-[9px] font-bold font-mono">
                    {prod.status}
                  </span>
                </div>
              </div>
            ))}
          </ContentTable>
        )}

        {/* Module G: Brand Properties Account */}
        {activeTab === 'account' && typeKey !== 'seller' && typeKey !== 'brand' && (
          <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
            <div className="border-b border-app-border pb-3">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Creative Brand Asset Description</h3>
              <p className="text-[11px] text-app-text-secondary mt-1">Ecosystem segment classifications and primary categories.</p>
            </div>
            <div className="p-4 bg-white/5 border border-app-border rounded space-y-2">
              <span className="text-[10px] text-app-text-secondary uppercase">Brand Manifesto Overview</span>
              <p className="text-xs text-app-text-secondary leading-relaxed font-sans">
                "{entityData.description}"
              </p>
            </div>
          </div>
        )}

        {/* Module H: Brand verification checkpoint */}
        {activeTab === 'verification' && typeKey !== 'seller' && typeKey !== 'brand' && (
          <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
            <div className="border-b border-app-border pb-3">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Brand Partnership Verification Checklist</h3>
              <p className="text-[11px] text-app-text-secondary mt-1">Trademark checks and verified license credentials approvals.</p>
            </div>
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-400 block tracking-widest font-mono uppercase">VERIFICATION PASSED</span>
                <p className="text-xs text-app-text-secondary leading-normal mt-1">
                  Brand claims successfully locked. Owner status authenticated under secure registry protocols.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Module I: Campaign Promotional Ads Insights */}
        {activeTab === 'ads' && typeKey !== 'seller' && typeKey !== 'brand' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
                <div className="border-b border-app-border pb-3">
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Promotion Campaigns</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Scheduled visibility caps, budget allocations, and conversion margins.</p>
                </div>
                <div className="overflow-x-auto rounded border border-app-border bg-app-bg/50 text-xs font-mono">
                  <table className="min-w-full divide-y divide-[#CBD5E1]/5">
                    <thead>
                      <tr className="bg-app-bg text-[10px] text-app-text-secondary uppercase text-left">
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Limit</th>
                        <th className="px-4 py-3 text-right">Spent</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.01] text-app-text-secondary">
                      {[
                        { name: 'Traditional Monsoon Festival Mega Boost', budget: '৳ 35,000', spend: '৳ 32,400', status: 'Active' },
                        { name: 'Eid Fashion Premium Spot', budget: '৳ 15,000', spend: '৳ 9,800', status: 'Scheduled' }
                      ].map((ad, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-bold text-app-text-primary">{ad.name}</td>
                          <td className="px-4 py-3 text-app-text-secondary">{ad.budget}</td>
                          <td className="px-4 py-3 text-right text-[#F4631E]">{ad.spend}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 uppercase font-mono">
                              {ad.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Historical ROI Conversions Chart</h3>
                <div className="h-44 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { day: 'Day 1', spend: 400, revenue: 1200 },
                      { day: 'Day 2', spend: 800, revenue: 2400 },
                      { day: 'Day 3', spend: 1200, revenue: 4800 },
                      { day: 'Day 4', spend: 2400, revenue: 9800 },
                      { day: 'Day 5', spend: 3200, revenue: 14200 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.05} />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B' }} />
                      <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="spend" name="Budget Dispatched (৳)" stroke="#EF4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="revenue" name="Storefront Revenue (৳)" stroke="#10B981" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* REVISED WORKSPACE TABS FOR SELLER / BRAND  */}
        {/* ========================================== */}

        {/* TAB 1: ⚙️ Account Information */}
        {activeTab === 'account' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Account Settings & Communication Preferences</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Manage passwords, sound notifications, message alerts, and 2FA keys.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider">Communication & Notifications</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 bg-white/5 border border-app-border p-3 rounded cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <input type="checkbox" defaultChecked className="rounded border-app-border text-app-accent focus:ring-0" />
                      <div>
                        <span className="text-xs font-bold text-app-text-primary block">Email Dispatch Alerts</span>
                        <span className="text-[10px] text-app-text-secondary block">Receive automated SLA alerts when dispatch windows close.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 bg-white/5 border border-app-border p-3 rounded cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <input type="checkbox" defaultChecked className="rounded border-app-border text-app-accent focus:ring-0" />
                      <div>
                        <span className="text-xs font-bold text-app-text-primary block">Whatsapp Sync Dispatch Logs</span>
                        <span className="text-[10px] text-app-text-secondary block">Ping warehouse manager directly on Whatsapp for incoming orders.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-app-accent-light uppercase tracking-wider">Authentication Credentials</h4>
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-white/5 border border-app-border rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-app-text-primary block">Admin Password</span>
                        <span className="text-[10px] text-app-text-secondary">Last updated 12 days ago</span>
                      </div>
                      <div className="flex gap-2">
                        <input type="password" value="••••••••••••" readOnly className="flex-1 bg-app-card/20 border border-app-border rounded px-2.5 py-1.5 text-xs text-app-text-primary outline-none" />
                        <button onClick={() => showToast('✓ Reset instruction sent to registered email.')} className="px-3 py-1.5 bg-white/5 border border-app-border hover:bg-white/10 text-app-text-primary rounded font-bold cursor-pointer transition-colors text-xs">Reset</button>
                      </div>
                    </div>
                    <div className="p-3.5 bg-white/5 border border-app-border rounded flex justify-between items-center">
                      <div>
                        <span className="font-bold text-app-text-primary block">Two-Factor Authentication (2FA)</span>
                        <span className="text-[10px] text-emerald-400 font-semibold truncate block mt-0.5">✓ SECURED WITH GOOGLE AUTHENTICATOR</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded text-[10px] uppercase font-black font-mono">ACTIVE</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 🧾 Verification Center */}
        {activeTab === 'verification' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Enterprise Verification Checklist & KYC Center</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Review legal documents, corporate tax clearances, and bank settlements escrow status.</p>
                </div>
                <div className="px-3.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider self-start sm:self-auto flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>VERIFICATION PASSED</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                  <span className="text-[9.5px] font-bold text-emerald-400 block uppercase tracking-widest font-sans">Trade License Registration</span>
                  <span className="text-app-text-primary block font-black">{(entityData as any).legalId || 'TRADE-RE-9410A'}</span>
                  <span className="text-[9px] text-app-text-secondary uppercase">Status: ACTIVE SLA</span>
                </div>
                <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                  <span className="text-[9.5px] font-bold text-indigo-400 block uppercase tracking-widest font-sans">Tax Certificate (TIN)</span>
                  <span className="text-app-text-primary block font-black">{(entityData as any).tin || 'TIN-48291039401'}</span>
                  <span className="text-[9px] text-app-text-secondary uppercase">Status: APPROVED TAXPAYER</span>
                </div>
                <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                  <span className="text-[9.5px] font-bold text-violet-400 block uppercase tracking-widest font-sans">VAT Business Identification (BIN)</span>
                  <span className="text-app-text-primary block font-black">{(entityData as any).bin || 'BIN-10928391039'}</span>
                  <span className="text-[9px] text-app-text-secondary uppercase">Status: VERIFIED 2026</span>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border space-y-3">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Settlement & Escrow Bank Verification</h4>
                <div className="p-4 bg-[#05050C] border border-[#202030] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-app-text-primary block">Mutual Trust Bank Bangladesh Ltd.</span>
                    <span className="text-[10.5px] text-app-text-secondary font-mono">Acc: 0182-0391-4829 &bull; Routing: 1352718911</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#00D4B2]/15 border border-[#00D4B2]/30 text-[#00D4B2] rounded-[2px] text-[10px] font-black tracking-widest uppercase font-mono">BANK VERIFIED</span>
                    <span className="text-[10px] text-slate-500 font-mono">Direct Tier T+3 Escrow Clearing Plan</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border space-y-3">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Submitted Trademark & Legal Attachments</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                  <div className="p-3 bg-white/5 border border-app-border hover:border-white/10 rounded flex justify-between items-center transition-colors">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 overflow-hidden shrink-0" />
                      <div className="overflow-hidden">
                        <span className="font-bold text-app-text-primary block truncate">Corporate_Trade_License_Aarong.pdf</span>
                        <span className="text-[10px] text-app-text-secondary font-mono">3.4 MB &bull; Signed Copy</span>
                      </div>
                    </div>
                    <button onClick={() => showToast('✓ Downloading Trade License PDF document.')} className="text-xs text-app-accent-light font-bold hover:underline cursor-pointer">Download</button>
                  </div>

                  <div className="p-3 bg-white/5 border border-app-border hover:border-white/10 rounded flex justify-between items-center transition-colors">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4.5 h-4.5 text-emerald-400 overflow-hidden shrink-0" />
                      <div className="overflow-hidden">
                        <span className="font-bold text-app-text-primary block truncate">TIN_NBR_Revenue_Certificate.pdf</span>
                        <span className="text-[10px] text-app-text-secondary font-mono">1.2 MB &bull; Digitally Signed</span>
                      </div>
                    </div>
                    <button onClick={() => showToast('✓ Downloading TIN Revenue PDF document.')} className="text-xs text-app-accent-light font-bold hover:underline cursor-pointer">Download</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Verification History & Administrative Actions</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Audit trial history for verification updates, claim approvals, or missing documents queries.</p>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3.5 bg-white/[0.02] border border-app-border rounded flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div className="space-y-1 flex-grow">
                    <div className="flex justify-between flex-wrap gap-1">
                      <span className="font-bold text-app-text-primary block">COMPLIANCE claim APPROVED</span>
                      <span className="text-[9.5px] text-slate-500 font-sans">June 12, 2026 - 11:30 AM</span>
                    </div>
                    <p className="text-[11px] text-app-text-secondary font-sans font-medium">Trade registry credentials matching complete database records. KYC clearance confirmed lock status verified.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-white/[0.02] border border-app-border rounded flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                  <div className="space-y-1 flex-grow">
                    <div className="flex justify-between flex-wrap gap-1">
                      <span className="font-bold text-app-text-primary block">TIN Document Upgrade requested</span>
                      <span className="text-[9.5px] text-slate-500 font-sans">June 08, 2026 - 02:15 PM</span>
                    </div>
                    <p className="text-[11px] text-app-text-secondary font-sans font-medium">Request uploaded updated digital proof for TIN ledger as signature was legacy. Document successfully re-uploaded by seller.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border flex flex-wrap gap-3">
                <button onClick={() => showToast('✓ Request dispatched: Missing SLA TIN Document alert.')} className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-xs font-bold border border-yellow-500/30 rounded cursor-pointer transition-all">Request Update / Alert Missing Doc</button>
                <button onClick={() => showToast('✓ Certification claim locked with NBR Registry.')} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 rounded cursor-pointer transition-all">Lock Verification Claim</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 🏬 Brand Portfolio */}
        {activeTab === 'portfolio' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            {typeKey === 'seller' && (entityData as any)?.brands?.length > 1 && (
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="text-left space-y-1">
                  <h3 className="text-sm font-bold text-app-text-primary">Active Customizer Brand Context</h3>
                  <p className="text-[11px] text-app-text-secondary">Select which owned brand portfolio you are designing using the Visual CMS.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-app-text-secondary font-medium">Select Brand:</span>
                  <select
                    value={selectedCMSBrandId}
                    onChange={(e) => {
                      setSelectedCMSBrandId(e.target.value);
                      showToast('✓ Switched visual portfolio dashboard brand context.');
                    }}
                    className="bg-[#05051C] border border-app-border text-xs font-bold text-app-text-primary px-4 py-2 rounded-[2px] outline-none focus:border-app-accent"
                  >
                    {((entityData as any).brands || []).map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <BrandEditStudio overrideId={selectedCMSBrandId || idKey || "1"} isNested={true} />
          </div>
        )}

        {/* TAB 4: 📦 Product Listings */}
        {activeTab === 'products' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-2.5 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(['All', 'Active', 'Draft', 'Pending Review', 'Rejected', 'Archived'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setProdStatusFilter(status);
                    showToast(`✓ Switched product filter: ${status}`);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-[2px] transition-all cursor-pointer whitespace-nowrap${
                    prodStatusFilter === status
                      ? 'bg-app-accent text-white shadow font-sans'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 font-sans'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <ContentTable 
              title={`${prodStatusFilter} Products Catalog List Pipeline`} 
              headers={['ID', 'Product Title', 'Active Retail Price', 'SLA Stocks Status', 'Status']}
            >
              {[
                { id: 'p101', title: 'Summer Cotton Silk Saree', price: '৳ 4,200', stock: '24 Available', status: 'Active' },
                { id: 'p102', title: 'Monsoon Pure Nakshi Kantha Saree', price: '৳ 12,500', stock: '8 Available', status: 'Active' },
                { id: 'p103', title: 'Eid Premium Panjabi Collection', price: '৳ 3,800', stock: '15 Available', status: 'Draft' },
                { id: 'p104', title: 'Traditional Tangail Handloom Saree', price: '৳ 4,500', stock: '0 Out of Stock', status: 'Pending Review' },
                { id: 'p105', title: 'Muslin Silk Exquisite Jamdani Saree', price: '৳ 25,000', stock: '5 Available', status: 'Active' },
                { id: 'p106', title: 'Synthetic Georgette Embroidery Kurti', price: '৳ 2,100', stock: '12 Available', status: 'Rejected' },
                { id: 'p107', title: 'Classical Cotton Salwar Kameez Suit', price: '৳ 1,950', stock: '30 Available', status: 'Archived' }
              ]
                .filter(p => prodStatusFilter === 'All' || p.status === prodStatusFilter)
                .map(prod => (
                  <div key={prod.id} className="grid grid-cols-12 gap-4 py-3.5 items-center hover:bg-white/5 transition-all border-b border-app-border px-2 font-sans">
                    <div className="col-span-2 text-xs font-mono text-app-text-secondary">{prod.id}</div>
                    <div className="col-span-4 text-xs font-bold text-app-text-primary">
                      <Link to={`/products/${getMockProductId(prod.title)}`} className="hover:underline hover:text-app-accent transition-colors">
                        {prod.title}
                      </Link>
                    </div>
                    <div className="col-span-2 text-xs font-bold text-app-text-primary font-mono">{prod.price}</div>
                    <div className="col-span-2 text-xs text-app-text-secondary font-mono">{prod.stock}</div>
                    <div className="col-span-2 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold font-mono border${
                        prod.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        prod.status === 'Draft' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        prod.status === 'Pending Review' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        prod.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-600/10 text-slate-500 border-slate-600/20'
                      }`}>
                        {prod.status}
                      </span>
                    </div>
                  </div>
                ))}
            </ContentTable>
          </div>
        )}

        {/* TAB 5: 📜 Order History */}
        {activeTab === 'orders' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-2.5 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(['All', 'Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Returned', 'Exchanged', 'Other'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setOrderStatusFilter(status);
                    showToast(`✓ Switched order filter: ${status}`);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-[2px] transition-all cursor-pointer whitespace-nowrap${
                    orderStatusFilter === status
                      ? 'bg-app-accent text-white shadow font-sans'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 font-sans'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <ContentTable 
              title={`${orderStatusFilter} Associated Orders Feed Log`} 
              headers={['Order ID', 'Category & Product', 'Quantity', 'Bill Status', 'Carrier Status', 'Subtotal']}
            >
              {[
                { id: '1081', product: { name: 'Summer Cotton Silk Saree', brand: 'Aarong Fabric' }, quantity: 2, paymentStatus: 'Paid', carrierStatus: 'Processing', price: 4200, status: 'Processing' },
                { id: '1082', product: { name: 'Monsoon Pure Nakshi Kantha Saree', brand: 'Aarong Fabric' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Delivered', price: 12500, status: 'Delivered' },
                { id: '1083', product: { name: 'Eid Premium Panjabi Collection', brand: 'Jamdani Royal' }, quantity: 3, paymentStatus: 'Paid', carrierStatus: 'In Transit', price: 3800, status: 'In Transit' },
                { id: '1084', product: { name: 'Traditional Tangail Handloom Saree', brand: 'Aarong Fabric' }, quantity: 1, paymentStatus: 'Unpaid', carrierStatus: 'Pending', price: 4500, status: 'Pending' },
                { id: '1085', product: { name: 'Synthetic Georgette Kurti', brand: 'Jamdani Royal' }, quantity: 1, paymentStatus: 'Refunded', carrierStatus: 'Cancelled', price: 2100, status: 'Cancelled' },
                { id: '1086', product: { name: 'Muslin Silk Exquisite Jamdani Saree', brand: 'Jamdani Royal' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Returned', price: 25000, status: 'Returned' },
                { id: '1087', product: { name: 'Exquisite Jamdani Fabric Saree', brand: 'Aarong Fabric' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Exchanged', price: 15000, status: 'Exchanged' },
                { id: '1088', product: { name: 'Muslin Silk Saree', brand: 'Jamdani Royal' }, quantity: 2, paymentStatus: 'Paid', carrierStatus: 'Dispatched', price: 22000, status: 'Dispatched' },
                { id: '1089', product: { name: 'Traditional Nakshi Kantha', brand: 'Aarong Fabric' }, quantity: 1, paymentStatus: 'Paid', carrierStatus: 'Confirmed', price: 12500, status: 'Confirmed' }
              ]
                .filter(o => {
                  if (orderStatusFilter === 'All') return true;
                  if (orderStatusFilter === 'Other') return o.status === 'Confirmed' || o.status === 'Processing';
                  return o.status === orderStatusFilter;
                })
                .map((ord: any) => (
                  <div key={ord.id} className="grid grid-cols-12 gap-4 py-3 items-center hover:bg-white/5 transition-colors border-b border-app-border px-2">
                    <div className="col-span-6 md:col-span-2">
                      <Link to={`/upe/order/${ord.id}`} className="text-xs font-bold text-[#F4631E] hover:underline font-mono">
                        #{ord.id}
                      </Link>
                    </div>
                    <div className="col-span-6 md:col-span-4">
                      <Link to={`/products/${getMockProductId(ord.product.name)}`} className="text-xs text-app-text-primary font-bold block truncate hover:underline hover:text-app-accent transition-colors">
                        {ord.product.name}
                      </Link>
                      <span className="text-[10px] text-app-text-secondary font-semibold font-mono block">Brand: {ord.product.brand}</span>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <span className="text-xs text-app-text-primary font-semibold block">{ord.quantity} items</span>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-widest border font-mono inline-block${
                        ord.paymentStatus === 'Paid' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        ord.paymentStatus === 'Unpaid' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {ord.paymentStatus}
                      </span>
                    </div>
                    <div className="col-span-4 md:col-span-2 text-right">
                      <span className="text-xs text-app-text-primary font-bold block font-mono">৳{(ord.price * ord.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
            </ContentTable>
          </div>
        )}

        {/* TAB 6: 🛡️ Reviews & Score */}
        {activeTab === 'reviews' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-6">
                <div className="border-b border-[#202030] pb-3 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-app-text-primary tracking-widest">Seller Reputation & Ratings Distribution</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-black text-app-text-primary font-mono">{(entityData as any).trustScore ? ((entityData as any).trustScore / 20).toFixed(1) : "4.9"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 bg-white/5 border border-app-border rounded-2xl text-center">
                    <span className="text-3xl font-black text-app-text-primary font-mono">{(entityData as any).trustScore ? ((entityData as any).trustScore / 20).toFixed(1) : "4.9"}</span>
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-[10px] text-app-text-secondary mt-2 uppercase font-bold">142 customer reviews</span>
                  </div>

                  <div className="sm:col-span-8 space-y-2 text-xs">
                    {[
                      { star: 5, pct: '85%' },
                      { star: 4, pct: '12%' },
                      { star: 3, pct: '2%' },
                      { star: 2, pct: '1%' },
                      { star: 1, pct: '0%' }
                    ].map((row) => (
                      <div key={row.star} className="flex items-center gap-3">
                        <span className="text-[11px] text-app-text-secondary whitespace-nowrap font-mono">{row.star} Star</span>
                        <div className="flex-grow bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full" style={{ width: row.pct }} />
                        </div>
                        <span className="text-[10px] text-app-text-secondary font-mono w-8 text-right">{row.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                <div className="border-b border-[#202030] pb-2">
                  <h3 className="text-xs font-black uppercase text-app-text-primary tracking-widest">Operational Risk & Compliance</h3>
                </div>
                <div className="space-y-4 py-4 text-xs">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                    <span className="text-app-text-secondary">Merchant Trust Index</span>
                    <span className="text-emerald-400 font-black font-mono">{(entityData as any).trustScore || 98}% Excellent</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                    <span className="text-app-text-secondary">Risk Assessment Tier</span>
                    <span className="px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase">Low Risk</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                    <span className="text-app-text-secondary">Compliance Audit Status</span>
                    <span className="px-2.5 py-0.5 bg-[#00D4B2]/15 border border-[#00D4B2]/30 text-[#00D4B2] rounded-xl text-[10px] font-black uppercase">COMPLIANT</span>
                  </div>
                </div>
                <div className="pt-2">
                  <span className="text-[9.5px] text-slate-500 uppercase font-black font-mono">Last SLA Audit: June 15, 2026</span>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-5 text-left">
              <div className="border-b border-[#202030] pb-3">
                <h3 className="text-xs font-black uppercase text-app-text-primary tracking-wider flex items-center gap-1.5">
                  🛡️ Operational Metrics, Escrow & Performance Ratios
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fulfillment Rate</div>
                  <div className="text-2xl font-black text-app-text-primary mt-1.5 font-mono">{(entityData as any).fulfillmentRate || '99.2%'}</div>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[99.2%]" style={{ width: '99.2%' }} />
                  </div>
                </div>

                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Return Ratio</div>
                  <div className="text-2xl font-black text-red-400 mt-1.5 font-mono">{(entityData as any).returnRate || '1.2%'}</div>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-red-500 h-full w-[1.2%]" style={{ width: '1.2%' }} />
                  </div>
                </div>

                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl flex flex-col justify-between">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cancellation Ratio</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1.5 font-mono">0.5%</div>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-400 h-full w-[0.5%]" style={{ width: '0.5%' }} />
                  </div>
                </div>

                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Complaint Rate</div>
                  <div className="text-xs font-bold text-app-text-primary mt-2 font-mono">0.1%</div>
                  <p className="text-[8px] text-slate-500 uppercase font-black font-mono mt-1">Excellent SLA Score</p>
                </div>

                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Warehouse Audit Score</div>
                  <div className="text-xs font-bold text-emerald-400 mt-2 font-mono font-sans">96 / 100</div>
                  <p className="text-[8px] text-[#00D4B2] uppercase font-black font-mono mt-1">Class A Approved</p>
                </div>

                <div className="bg-[#05050C] border border-[#202030] p-4 rounded-2xl text-left">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Overall Trust Score</div>
                  <div className="text-xs font-bold text-app-text-primary mt-2 font-mono">{(entityData as any).trustScore || 98} Rating</div>
                  <p className="text-[8px] text-slate-500 uppercase font-black font-mono mt-1">Elite Merchant Medal</p>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-[#202030] rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Historical Trust Performance Analytics</h3>
              <div className="h-44 pt-2 font-sans">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { month: 'Jan', trust: 92, fulfillment: 96 },
                    { month: 'Feb', trust: 94, fulfillment: 97 },
                    { month: 'Mar', trust: 95, fulfillment: 98 },
                    { month: 'Apr', trust: 97, fulfillment: 99 },
                    { month: 'May', trust: 98, fulfillment: 99.2 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.05} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B' }} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="trust" name="Trust Rating (%)" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="fulfillment" name="Fulfillment Rate (%)" stroke="#10B981" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider font-sans">Customer Feedback & Reviews</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Direct feedback from verified end consumer orders.</p>
              </div>
              <div className="space-y-4 text-xs font-sans">
                {[
                  { name: 'Suhana Chowdhury', rating: 5, date: 'June 14, 2026', comment: 'Exquisite silk saree! The stitching details on the Jamdani margins are perfect.' },
                  { name: 'Tanvir Rahman', rating: 5, date: 'June 10, 2026', comment: 'Very responsive support team. Saree delivered within 24 hours via Paperfly.' },
                  { name: 'Mahrin Islam', rating: 4, date: 'June 05, 2026', comment: 'Beautiful traditional Tangail handloom. Loved the packaging design.' }
                ].map((fb, idx) => (
                  <div key={idx} className="p-4 bg-white/5 border border-app-border rounded space-y-2 text-app-text-secondary">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-app-text-primary">{fb.name}</span>
                      <span className="text-[10px] text-app-text-secondary font-mono">{fb.date}</span>
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: fb.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs text-app-text-secondary leading-relaxed font-sans font-medium">"{fb.comment}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: 📢 Ads & Deals */}
        {activeTab === 'ads' && (typeKey === 'seller' || typeKey === 'brand') && (
          <div className="space-y-6 text-left">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 font-sans">
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Impressions</span>
                <span className="text-lg font-black text-app-text-primary block mt-1 font-mono">1.2M</span>
                <span className="text-[9px] text-emerald-400 font-mono font-bold">+18.4% MTD</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Clicks</span>
                <span className="text-lg font-black text-app-text-primary block mt-1 font-mono">42.5K</span>
                <span className="text-[9px] text-emerald-400 font-mono font-bold">3.54% CTR</span>
              </div>
              <div className="bg-[#050512] border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Overall Budget</span>
                <span className="text-lg font-black text-app-text-primary block mt-1 font-mono">৳ 50,000</span>
                <span className="text-[9px] text-slate-500 font-mono font-bold">Allocated</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Total Spend</span>
                <span className="text-lg font-black text-rose-400 block mt-1 font-mono">৳ 42,200</span>
                <span className="text-[9px] text-rose-400 font-mono font-bold">84.4% Dispatched</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Conversions</span>
                <span className="text-lg font-black text-emerald-400 block mt-1 font-mono">4,120</span>
                <span className="text-[9px] text-[#00D4B2] font-mono font-bold">9.69% Conv Rate</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-xl text-left">
                <span className="text-[9px] text-app-text-secondary uppercase block font-mono font-bold">Attributed GTV</span>
                <span className="text-lg font-black text-emerald-400 block mt-1 font-mono">৳ 180,420</span>
                <span className="text-[9px] text-emerald-400 font-mono font-bold">4.27x ROAS</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
              <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
                <div className="border-b border-app-border pb-3">
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Promotion Campaigns (Sponsored Ads)</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Scheduled visibility caps, budget allocations, and conversion margins.</p>
                </div>
                <div className="overflow-x-auto rounded border border-app-border bg-app-bg/50 text-xs font-mono">
                  <table className="min-w-full divide-y divide-[#CBD5E1]/5 font-sans">
                    <thead>
                      <tr className="bg-app-bg text-[10px] text-app-text-secondary uppercase text-left font-sans">
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Limit</th>
                        <th className="px-4 py-3 text-right">Spent</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.01] text-app-text-secondary font-sans">
                      {[
                        { name: 'Traditional Monsoon Festival Mega Boost', budget: '৳ 35,000', spend: '৳ 32,400', status: 'Active' },
                        { name: 'Eid Fashion Premium Spot', budget: '৳ 15,000', spend: '৳ 9,800', status: 'Scheduled' },
                        { name: 'Spring Saree Collection Launch ad', budget: '৳ 20,000', spend: '৳ 20,000', status: 'Completed' },
                        { name: 'Mid-Season Jamdani Clearance Bump', budget: '৳ 10,000', spend: '৳ 0', status: 'Paused' }
                      ].map((ad, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-bold text-app-text-primary">{ad.name}</td>
                          <td className="px-4 py-3 text-app-text-secondary">{ad.budget}</td>
                          <td className="px-4 py-3 text-right text-[#F4631E]">{ad.spend}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-[2px] text-[9px] font-bold border uppercase font-mono${
                              ad.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              ad.status === 'Scheduled' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              ad.status === 'Paused' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
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

              <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Historical ROI Conversions Chart</h3>
                <div className="h-44 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { day: 'Day 1', spend: 400, revenue: 1200 },
                      { day: 'Day 2', spend: 800, revenue: 2400 },
                      { day: 'Day 3', spend: 1200, revenue: 4800 },
                      { day: 'Day 4', spend: 2400, revenue: 9800 },
                      { day: 'Day 5', spend: 3200, revenue: 14200 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.05} />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B' }} />
                      <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                      <Line type="monotone" dataKey="spend" name="Budget Dispatched (৳)" stroke="#EF4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="revenue" name="Storefront Revenue (৳)" stroke="#10B981" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider font-sans">Storefront Sales Campaigns, Deals & Coupons</h3>
                  <p className="text-[11px] text-app-text-secondary mt-1">Configure active buyer discounting incentives, limited countdown offers, and affiliate coupons.</p>
                </div>
                <button onClick={() => showToast('✓ Initiated creator affiliate discounting coupon form.')} className="px-3.5 py-1.5 bg-[#F4631E] hover:bg-orange-500 text-white rounded-[2px] text-xs font-bold transition-colors cursor-pointer">Create Deal</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                {[
                  { name: 'Monsoon Flash Monsoon Frenzy', type: 'Flash Deals', value: 'Up to 25% Off Saree Catalogs', status: 'Active SLA', detail: 'Runs till Friday midnight GMT+6' },
                  { name: 'WELCOME-CH-2026 Promo', type: 'Coupons', value: '৳ 500 flat discount for 1st buy', status: 'Active SLA', detail: 'Used 2,420 times across channels' },
                  { name: 'Dual Silk Saree Bundle Offer', type: 'Bundle Offers', value: 'Free handwoven Kurti on buy 2', status: 'Active SLA', detail: 'Aesthetic luxury gifting boxes included' },
                  { name: 'Eid Ul Adha Pre-Order Campaign', type: 'Discount Campaigns', value: 'Flat 10% cashback on Card settlement', status: 'Active SLA', detail: 'Applicable for all verified card partners' },
                  { name: 'Exclusive Muslin Limited Spot Deal', type: 'Limited Offers', value: 'Only 5 stock items reserved', status: 'Active SLA', detail: 'Exclusive velvet jewelry storage pouch included' }
                ].map((deal, idx) => (
                  <div key={idx} className="p-4 bg-white/5 border border-app-border hover:border-white/10 rounded flex justify-between items-start gap-4 transition-colors">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-[2px] text-[9px] font-bold uppercase tracking-widest font-mono inline-block">{deal.type}</span>
                      <h4 className="font-bold text-app-text-primary block text-xs pt-1">{deal.name}</h4>
                      <p className="text-[11px] text-emerald-400 font-semibold">{deal.value}</p>
                      <span className="text-[10px] text-app-text-secondary block font-sans">{deal.detail}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-[2px] text-[9px] font-black uppercase font-mono shrink-0 border border-emerald-500/20">{deal.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Module J: Order cargo breakdown */}
        {activeTab === 'overview' && typeKey === 'order' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            <div className="lg:col-span-2 bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">SLA Order Cargo Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                  <span className="text-[10px] text-app-text-secondary uppercase">Product Segment</span>
                  <span className="text-app-text-primary block font-bold">{entityData.product.name}</span>
                  <span className="text-[11px] text-app-accent-light">Brand: {entityData.product.brand}</span>
                </div>
                <div className="p-4 bg-white/5 border border-app-border rounded space-y-1">
                  <span className="text-[10px] text-app-text-secondary uppercase">Quantity & pricing</span>
                  <span className="text-app-text-primary block font-bold">{entityData.quantity} Units</span>
                  <span className="text-[11px] text-emerald-400 font-mono">Retail: ৳ {entityData.product.price.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-app-text-primary uppercase border-b border-app-border pb-2">Administrative SLA Actions</h3>
                <button onClick={handleOrderDispatchSLA} className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30 rounded cursor-pointer transition-all">
                  Set Cargo In-Transit
                </button>
                <button onClick={handleOrderCancelSLA} className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/30 rounded cursor-pointer transition-all">
                  Void & Refund Ledger
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Module K: Order Billing Settlements Finance */}
        {activeTab === 'finance' && typeKey === 'order' && (
          <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6 font-mono text-xs">
            <div className="border-b border-app-border pb-3 font-sans">
              <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Settlement Financial ledger</h3>
              <p className="text-[11px] text-app-text-secondary mt-1">Approved Platform Commission percentages and payout receipts.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 border border-app-border rounded">
                <span className="text-[9px] text-app-text-secondary uppercase">Subtotal Revenue</span>
                <span className="text-sm font-bold text-app-text-primary block mt-1">৳ {entityData.financials.revenue.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-white/5 border border-app-border rounded">
                <span className="text-[9px] text-app-text-secondary uppercase">Platform Fee Cut ({entityData.financials.commPercent}%)</span>
                <span className="text-sm font-bold text-rose-400 block mt-1">৳ {entityData.financials.commissionCut.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-white/5 border border-white/15 rounded">
                <span className="text-[9px] text-emerald-400 font-bold uppercase">Seller Net Disbursed</span>
                <span className="text-sm font-bold text-emerald-400 block mt-1">৳ {entityData.financials.sellerNet.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* REVISED WORKSPACE TABS FOR CREATORS        */}
        {/* ========================================== */}

        {/* TAB 1: ⚙️ Account Information */}
        {activeTab === 'account' && typeKey === 'creator' && entityData && (
          <div className="space-y-6 text-left">
            {/* Notification Preferences & Password Security Section */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Account Settings & Communication Preferences</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Manage passwords, notifications sound, message alerts, and security properties.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#F4631E] uppercase tracking-wider">Notification Preferences</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 bg-white/5 border border-app-border p-3 rounded cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <input type="checkbox" defaultChecked className="rounded border-app-border text-app-accent focus:ring-0" />
                      <div>
                        <span className="text-xs font-bold text-app-text-primary block">Email Dispatch Alerts</span>
                        <span className="text-[10px] text-app-text-secondary block">Receive reports when buying guides are approved.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 bg-white/5 border border-app-border p-3 rounded cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <input type="checkbox" defaultChecked className="rounded border-app-border text-app-accent focus:ring-0" />
                      <div>
                        <span className="text-xs font-bold text-app-text-primary block">SMS Campaign Sync Alerts</span>
                        <span className="text-[10px] text-app-text-secondary block">Notify phone regarding high-value affiliate contract opportunities.</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 bg-white/5 border border-app-border p-3 rounded cursor-pointer hover:bg-white/[0.08] transition-colors">
                      <input type="checkbox" className="rounded border-app-border text-app-accent focus:ring-0" />
                      <div>
                        <span className="text-xs font-bold text-app-text-primary block">Privacy Settings: Incognito Views</span>
                        <span className="text-[10px] text-app-text-secondary block">Keep metrics telemetry private from competitive models.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-app-accent-light uppercase tracking-wider">Authentication & Connected Socials</h4>
                  <div className="space-y-3 text-xs font-sans">
                    <div className="p-3 bg-white/5 border border-app-border rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-app-text-primary block">Password & Security</span>
                        <span className="text-[10px] text-app-text-secondary">Updated 24 days ago</span>
                      </div>
                      <div className="flex gap-2">
                        <input type="password" value="••••••••••••" readOnly className="flex-1 bg-app-card/20 border border-app-border rounded px-2.5 py-1.5 text-xs text-app-text-primary outline-none font-mono" />
                        <button onClick={() => showToast('✓ Reset instruction secure link dispatched.', 'success')} className="px-3 py-1.5 bg-white/5 border border-app-border hover:bg-white/10 text-app-text-primary rounded font-bold cursor-pointer transition-colors text-xs font-sans">Reset</button>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 border border-app-border rounded flex justify-between items-center">
                      <div>
                        <span className="font-bold text-app-text-primary block">Two-Factor Authentication (2FA)</span>
                        <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">✓ Secured with Google Authenticator</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] uppercase font-bold font-mono">ACTIVE</span>
                    </div>
                    <div className="p-3 bg-white/5 border border-app-border rounded space-y-1.5">
                      <span className="font-bold text-app-text-primary block">Connected Accounts</span>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[9.5px] font-mono">Google Synced</span>
                        <span className="px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded text-[9.5px] font-mono">Instagram Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 🧾 Verification Center */}
        {activeTab === 'verification' && typeKey === 'creator' && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6 font-sans">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">🧾 Verification Center</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Audit status, ID checking, Face authentication, Tax and Bank settlements validation.</p>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-400 block tracking-wider uppercase font-sans">IDENTITY VERIFICATION PASSED</span>
                  <p className="text-xs text-app-text-secondary leading-normal mt-1">
                    Your governmental registered National ID, face biometric matches, and physical address parameters have been successfully authorized.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-app-accent-light uppercase tracking-wider">KYC Verification Checklist</h4>
                  <div className="divide-y divide-white/5 text-xs font-sans">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">National ID / Passport Check</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Verified (Bangladesh NID)</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Face Biometric Match</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Match Ratio 99.4%</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Living Address Proof</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Utility Bill Authenticated</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Platform Trust Status</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Exemplary standing</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tax & Settlement Verification</h4>
                  <div className="divide-y divide-white/5 text-xs font-sans">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Tax Identification Number (TIN)</span>
                      <span className="text-indigo-400 font-mono">TIN-5561049281-BD</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">TIN Document Proof</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">✓ Verified Legal Taxpayer</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Bank Settling Account</span>
                      <span className="text-app-text-secondary font-mono">City Bank Ltd, Dhaka (AcCT 4402•••89)</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-app-text-primary">Payment Gateway Connectivity</span>
                      <span className="text-emerald-400 font-bold">✓ Active Direct Escrow</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border space-y-3 font-sans">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Uploaded Legal KYC Documents List</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white/5 border border-app-border rounded flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-app-accent-light" />
                      <div>
                        <span className="font-bold text-app-text-primary block">govt_national_id_front.jpg</span>
                        <span className="text-[10px] text-app-text-secondary">Uploaded: 12 January, 2024</span>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-bold font-mono text-[10px]">PASSED</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-app-border rounded flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-app-accent-light" />
                      <div>
                        <span className="font-bold text-app-text-primary block">tin_clearance_certificate.pdf</span>
                        <span className="text-[10px] text-app-text-secondary">Uploaded: 14 January, 2024</span>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-bold font-mono text-[10px]">PASSED</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border font-sans">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider mb-2">Verification History Timeline Log</h4>
                <div className="space-y-4 pl-3.5 border-l border-app-border text-xs">
                  <div className="relative">
                    <div className="absolute w-2 h-2 rounded-full bg-emerald-400 -left-[19px] top-1" />
                    <span className="text-emerald-400 font-bold font-mono">15 January, 2024</span>
                    <p className="text-app-text-secondary mt-1">Admin checked TIN registration and updated bank status to APPROVED.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute w-2 h-2 rounded-full bg-emerald-400 -left-[19px] top-1" />
                    <span className="text-emerald-400 font-bold font-mono">12 January, 2024</span>
                    <p className="text-app-text-secondary mt-1">Identity authenticity NID verified automatically via National Registry gateway API.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 🏬 Creator Portfolio */}
        {activeTab === 'portfolio' && typeKey === 'creator' && entityData && (
          <div className="space-y-6 text-left">
            {/* Creator Profile Overview Section */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6 font-sans">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">🏬 Creator Portfolio</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">View the primary portfolio workspace representing reviews, guides, categories, and reach statistics.</p>
              </div>

              {/* Creator Banner Visual Block */}
              <div className="relative rounded overflow-hidden h-36 bg-gradient-to-r from-[#F4631E]/20 to-indigo-600/20 border border-app-border flex items-center justify-between p-6">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold font-mono text-[#F4631E] px-2 py-0.5 bg-[#F4631E]/10 border border-[#F4631E]/20 rounded-sm">Verified Creator Space</span>
                  <h4 className="text-lg font-black text-app-text-primary">{entityData.name} Showcase Banner</h4>
                  <p className="text-xs text-app-text-secondary">Curating the highest quality heritage fashion & weaves recommendations.</p>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <span className="text-xs text-app-text-secondary block font-mono">Total Reach Metrics</span>
                  <span className="text-sm font-black text-app-text-primary block">{entityData.totalViews || '45.2K views'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] text-[#F4631E] uppercase block font-bold font-mono">Biography Pitch</span>
                  <p className="text-app-text-secondary leading-relaxed">
                    {entityData.persona || 'Bespoke review writer and lifestyle creator based in Dhaka, Bangladesh. Curates the finest Traditional Jamdani and Boutique dresses since 2022.'}
                  </p>
                </div>
                <div className="space-y-2 text-xs">
                  <span className="text-[10px] text-indigo-400 uppercase block font-bold font-mono">Connected Social Networks</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2.5 py-1 bg-white/5 border border-app-border rounded text-app-text-secondary">Instagram: @rifat_reviews</span>
                    <span className="px-2.5 py-1 bg-white/5 border border-app-border rounded text-app-text-secondary">TikTok: @rifat_curates</span>
                    <span className="px-2.5 py-1 bg-white/5 border border-app-border rounded text-app-text-secondary">YouTube: Rifat Weaves</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio Statistics Section */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans">
                <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Guides</span>
                <span className="text-base font-black text-app-text-primary block mt-1">{creatorGuides.length} Items</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans">
                <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Views</span>
                <span className="text-base font-black text-[#F4631E] block mt-1">{entityData.totalViews || '45.2K'}</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans">
                <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Followers</span>
                <span className="text-base font-black text-indigo-400 block mt-1">{entityData.followers || '42.5k'}</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans">
                <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Recs</span>
                <span className="text-base font-black text-emerald-400 block mt-1">{creatorRecommendedProducts.length} Listings</span>
              </div>
              <div className="bg-app-card border border-app-border p-4 rounded-[4px] shadow-md text-left font-sans col-span-2 md:col-span-1">
                <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Featured Products</span>
                <span className="text-base font-black text-app-text-primary block mt-1">18 Items</span>
              </div>
            </div>

            {/* Guide Studio & Editorial CMS Embedded */}
            <GuideStudioCMS 
              mode="embedded" 
              entity="creator" 
              guides={creatorGuides} 
              onChange={setCreatorGuides} 
              authorName={entityData.name} 
              authorAvatar={entityData.avatarUrl} 
              authorVerified={entityData.verifiedContributor || true} 
            />
          </div>
        )}

        {/* TAB 4: 📢 Recommended Product Listings */}
        {activeTab === 'recommended_products' && typeKey === 'creator' && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-2.5 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(['All', 'Active', 'Hidden', 'Archived'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setRecProductStatusFilter(status);
                    showToast(`✓ Switched product filter: ${status}`);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-[2px] transition-all cursor-pointer whitespace-nowrap${
                    recProductStatusFilter === status
                      ? 'bg-app-accent text-white shadow font-sans'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 font-sans'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <ContentTable 
              title={`${recProductStatusFilter} Products Recommended List Pipeline`} 
              headers={['Product Info', 'Brand & Category', 'Retail Price', 'Affiliate Status', 'Performance Tracker', 'Actions']}
            >
              {creatorRecommendedProducts
                .filter(p => recProductStatusFilter === 'All' || p.status === recProductStatusFilter)
                .map((prod) => (
                  <div key={prod.id} className="grid grid-cols-12 gap-4 py-4 items-center hover:bg-white/5 transition-all border-b border-app-border px-2 font-sans text-xs text-left">
                    <div className="col-span-12 md:col-span-3 flex items-center gap-2.5">
                      <div className="w-10 h-10 border border-app-border rounded overflow-hidden shrink-0">
                        <img src={prod.image} alt="" className="w-full h-full object-cover animate-fade-in" />
                      </div>
                      <div>
                        <span className="text-[10px] text-app-text-secondary uppercase block font-mono">{prod.id}</span>
                        <h4 className="text-app-text-primary font-bold leading-tight">{prod.title}</h4>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-2">
                      <span className="text-app-text-primary block font-bold">{prod.brand}</span>
                      <span className="text-[10px] text-app-text-secondary block mt-0.5">{prod.category}</span>
                    </div>

                    <div className="col-span-6 md:col-span-1 font-mono text-app-text-primary font-bold">
                      ৳ {prod.price.toLocaleString()}
                    </div>

                    <div className="col-span-6 md:col-span-2 md:text-center">
                      <span className="inline-block px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold font-mono rounded">
                        {prod.affiliateStatus}
                      </span>
                    </div>

                    <div className="col-span-6 md:col-span-2 font-mono text-app-text-secondary text-[11px]">
                      {prod.performance}
                    </div>

                    <div className="col-span-6 md:col-span-2 flex justify-end gap-1.5">
                      <button 
                        onClick={() => navigate(`/products/${getMockProductId(prod.title)}`)} 
                        className="p-1 px-2 bg-white/5 hover:bg-white/10 text-app-text-primary rounded flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors font-sans whitespace-nowrap"
                      >
                        View Product
                      </button>
                      <button 
                        onClick={() => {
                          const updated = creatorRecommendedProducts.map(item => {
                            if (item.id === prod.id) {
                              const nextStatus = item.status === 'Active' ? 'Hidden' : 'Active';
                              showToast(`✓ Recommendation status changed: ${nextStatus}`);
                              return { ...item, status: nextStatus };
                            }
                            return item;
                          });
                          setCreatorRecommendedProducts(updated);
                        }} 
                        className="p-1 px-2 bg-app-card border border-app-border text-app-text-secondary hover:text-white rounded text-[10px] font-bold cursor-pointer transition-all font-sans whitespace-nowrap"
                      >
                        Toggle Status
                      </button>
                    </div>
                  </div>
                ))}
            </ContentTable>
          </div>
        )}

        {/* TAB 5: 🎞 Recommendations & Guides Listings */}
        {activeTab === 'content_listings' && typeKey === 'creator' && (
          <div className="space-y-6 text-left">
            <div className="bg-app-card border border-app-border rounded-[4px] p-2.5 shadow-xl flex gap-1.5 overflow-x-auto scrollbar-hide">
              {(['All', 'Published', 'Draft', 'Scheduled', 'Under Review', 'Archived'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setContentListingsStatusFilter(status);
                    showToast(`✓ Switched content list filter: ${status}`);
                  }}
                  className={`text-xs font-bold px-4 py-2 rounded-[2px] transition-all cursor-pointer whitespace-nowrap${
                    contentListingsStatusFilter === status
                      ? 'bg-app-accent text-white shadow font-sans'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 font-sans'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <ContentTable 
              title="Creator Recommendations & Digital Guides Marketplace Pipeline"
              headers={['Listing info', 'Media format Type', 'Publish Date', 'Counters Traffic', 'Review Rating Status', 'Actions']}
            >
              {creatorContentListings
                .filter(c => contentListingsStatusFilter === 'All' || c.status === contentListingsStatusFilter)
                .map((cont) => (
                  <div key={cont.id} className="grid grid-cols-12 gap-4 py-4 items-center hover:bg-white/5 transition-all border-b border-app-border px-2 font-sans text-xs text-left">
                    <div className="col-span-12 md:col-span-3 flex items-center gap-2.5">
                      <div className="w-10 h-10 border border-app-border rounded overflow-hidden shrink-0">
                        <img src={cont.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-[10px] text-app-text-secondary uppercase block font-mono">{cont.id}</span>
                        <h4 className="text-app-text-primary font-bold leading-tight">{cont.title}</h4>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <span className="inline-block px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-[9px] rounded uppercase font-mono">
                        {cont.type}
                      </span>
                    </div>

                    <div className="col-span-6 md:col-span-2 font-mono text-app-text-primary text-[11px]">
                      {cont.publishDate}
                    </div>

                    <div className="col-span-12 md:col-span-2 font-mono space-y-0.5 text-[10.5px]">
                      <div className="flex justify-between max-w-[120px]">
                        <span className="text-app-text-secondary font-sans">Views:</span>
                        <span className="text-app-text-primary font-bold">{cont.views}</span>
                      </div>
                      <div className="flex justify-between max-w-[120px]">
                        <span className="text-app-text-secondary font-sans">Likes:</span>
                        <span className="text-emerald-400 font-bold">{cont.likes}</span>
                      </div>
                      <div className="flex justify-between max-w-[120px]">
                        <span className="text-app-text-secondary font-sans">Saves:</span>
                        <span className="text-indigo-400 font-bold">{cont.saves}</span>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-1.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold font-mono border${
                        cont.status === 'Published' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        cont.status === 'Draft' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                        cont.status === 'Scheduled' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        cont.status === 'Under Review' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-slate-600/10 text-slate-500 border-slate-600/20'
                      }`}>
                        {cont.status}
                      </span>
                    </div>

                    <div className="col-span-6 md:col-span-1.5 flex justify-end gap-1">
                      <button 
                        onClick={() => showToast(`✓ Redirecting to inspect digital layout for '${cont.title}'`)} 
                        className="p-1 px-2 bg-white/5 hover:bg-white/10 text-app-text-primary rounded text-[10px] font-bold cursor-pointer transition-colors font-sans"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
            </ContentTable>
          </div>
        )}

        {/* TAB 6: 🛡️ Reviews & Score */}
        {activeTab === 'reviews' && typeKey === 'creator' && entityData && (
          <div className="space-y-6 text-left font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Community Rating */}
              <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-6">
                <div className="border-b border-app-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#F4631E]">Community Rating Feedback</h3>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center shrink-0">
                    <span className="text-3xl font-black text-app-text-primary block">4.9</span>
                    <div className="flex gap-0.5 text-amber-400 justify-center mt-1">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </div>
                    <span className="text-[10px] text-app-text-secondary mt-1 block font-mono">842 reviews</span>
                  </div>

                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right text-app-text-secondary">5 ★</span>
                      <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full" style={{ width: '85%' }} />
                      </div>
                      <span className="w-8 text-right text-app-text-secondary font-mono">85%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right text-app-text-secondary">4 ★</span>
                      <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full" style={{ width: '12%' }} />
                      </div>
                      <span className="w-8 text-right text-app-text-secondary font-mono">12%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-right text-app-text-secondary">3 ★</span>
                      <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full" style={{ width: '3%' }} />
                      </div>
                      <span className="w-8 text-right text-app-text-secondary font-mono">3%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-6">
                <div className="border-b border-app-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#F4631E]">Engagement Metrics</h3>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs text-center font-sans">
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Followers</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">{entityData.followers || '42.5k'}</span>
                  </div>
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Views</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">{entityData.totalViews || '45.2K'}</span>
                  </div>
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Total Likes</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">9.4K</span>
                  </div>
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">saves</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">3.8K</span>
                  </div>
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Shares</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">1.2K</span>
                  </div>
                  <div className="p-3.5 bg-white/5 border border-app-border rounded">
                    <span className="text-[10px] text-app-text-secondary uppercase block font-mono">Comments</span>
                    <span className="text-sm font-black text-app-text-primary block mt-1.5">640</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Commerce Performance */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Commerce Performance</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">SLA conversion rate, referential revenue generated, and affiliate balance.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
                <div className="p-4 bg-white/5 border border-app-border rounded">
                  <span className="text-[10px] text-app-text-secondary uppercase block">Products Recommended</span>
                  <span className="text-base font-black text-app-text-primary block mt-1">{creatorRecommendedProducts.length} Items</span>
                </div>
                <div className="p-4 bg-white/5 border border-app-border rounded">
                  <span className="text-[10px] text-app-text-secondary uppercase block">Conversion Rate</span>
                  <span className="text-base font-black text-[#F4631E] block mt-1">{entityData.conversionRate || '5.8%'} avg</span>
                </div>
                <div className="p-4 bg-white/5 border border-app-border rounded">
                  <span className="text-[10px] text-app-text-secondary uppercase block">Revenue Generated</span>
                  <span className="text-base font-black text-indigo-400 block mt-1">{entityData.revenueGenerated || '৳ 382,200'}</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/15 rounded">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">Affiliate Earnings</span>
                  <span className="text-base font-black text-emerald-400 block mt-1">৳ 34,200 (Active Escrow)</span>
                </div>
              </div>
            </div>

            {/* Platform Health and Policy Audits */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl space-y-6">
              <div className="border-b border-app-border pb-3">
                <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Platform Health & Policy Compliance Registries</h3>
                <p className="text-[11px] text-app-text-secondary mt-1">Ecosystem risk analysis, warned history logs, and quality scores.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-left">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block tracking-widest font-mono">CREATOR QUALITY STANDING: A+ EXCELLENT</span>
                    <p className="text-xs text-app-text-secondary leading-normal mt-1">
                      Account has 100% adherence to community guides. Content accuracy, consumer helpfulness scores, and click metrics are exemplary.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block tracking-widest font-mono">TRUST SCORE: 99 / 100</span>
                    <p className="text-xs text-app-text-secondary leading-normal mt-1">
                      Trust score is near perfect. Fast response to comments, consistent publications, authentic and verified recommendations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/5 text-xs">
                <div className="py-3 flex justify-between items-center">
                  <span className="text-app-text-primary">Active Policy Violations</span>
                  <span className="text-emerald-400 font-bold font-mono text-[11px]">0 Violations Match</span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-app-text-primary">Flagged Content Reports</span>
                  <span className="text-emerald-400 font-bold font-mono text-[11px]">0 Reports Flagged</span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-app-text-primary">Warning History Archive</span>
                  <span className="text-app-text-secondary font-mono text-[11px]">Clean Logs Profile</span>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <span className="text-app-text-primary">Historical Suspensions / Restricting Orders</span>
                  <span className="text-app-text-secondary font-mono text-[11px]">None</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </ProfileLayout>

      {renderInspectModal()}
    </div>
  );
}
