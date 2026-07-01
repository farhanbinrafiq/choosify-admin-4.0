import React, { useState, useEffect } from 'react';
import { 
  Layout, Compass, Tag, Building2, Megaphone, Folder, 
  Search, Share2, Image as ImageIcon, Sparkles, Globe, Activity, Trash2, Plus, 
  Pencil, ArrowUp, ArrowDown, Check, RotateCcw, History, User, Lock, Settings, 
  AlertTriangle, Save, Undo, Eye, X, ChevronRight, ChevronDown, Layers, Link as LinkIcon,
  Heart, Menu, RefreshCw, Sliders, Play, CheckSquare, Undo2, GripVertical, AlertCircle, 
  CheckCircle2, TrendingUp, Flame, ShieldCheck, FileText, ShoppingBag, Star,
  Zap, BookOpen, Award, Users, PanelRight, PanelRightClose,
  Monitor, Smartphone as SmartphoneIcon, ChevronUp, Pin, PinOff, Timer,
  X as XIcon, Search as SearchIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCMS, createCMSLogEntry } from '../../contexts/CMSContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBrandProfiles } from '../../contexts/BrandProfilesContext';
import { useAds } from '../../contexts/AdsContext';
import { catalogApi } from '../../services/catalogApi';

// Types for workspaces
type WorkspaceId = 
  | 'homepage' | 'hero-banners' | 'navigation' | 'footer' 
  | 'search-experience' | 'product-badges' | 'featured-products' 
  | 'featured-brands' | 'featured-creators' | 'promotions' 
  | 'social-media' | 'website-assets' | 'seo' | 'global-settings' | 'activity-log'
  | 'featured-deals' | 'spotlight-brands' | 'sponsored-ads'
  | 'sponsored-brands' | 'sponsored-products' | 'featured-recommendations'
  | 'recommended-brands' | 'recommended-products' | 'recommended-creators';

export interface FeaturedItem {
  id: string;
  name: string;
  image?: string;
  brand?: string;
  category?: string;
  price?: number;
  type: 'product' | 'brand' | 'creator' | 'guide';
  isPinned?: boolean;
  addedAt: string;
}

export interface SponsoredItem extends FeaturedItem {
  sponsorType: 'sponsored_product' | 'sponsored_brand' | 'spotlight_brand' | 'sponsored_deal' | 'sponsored_recommendation';
  startDate: string;
  endDate: string;
  hasCountdown: boolean;
  isTimedDeal?: boolean;
  dealPrice?: number;
  originalPrice?: number;
  promotionId?: string; // ID of the Promotion created in AdsContext
  spotlightStyle?: string;
}

interface WorkspaceGroup {
  label: string;
  items: { id: WorkspaceId; label: string; icon: any }[];
}

// Simple local toggle component matching instructions
const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => {
  return (
    <div 
      onClick={() => onChange(!enabled)}
      className={`w-10 h-5 rounded-full cursor-pointer transition-colors relative flex items-center ${enabled ? 'bg-app-accent' : 'bg-gray-200'}`}
    >
      <div 
        className={`w-4 h-4 rounded-full bg-white shadow absolute transition-transform duration-200 ${enabled ? 'translate-x-[22px]' : 'translate-x-1'}`}
      />
    </div>
  );
};

// Seed Data for Search Experience in Featured Items workspaces
const SEARCHABLE_ITEMS = {
  product: [
    { id: 'p_apex', name: 'Apex Sprint Running Shoes', details: 'Category: Apparel • ৳3,490' },
    { id: 'p_aarong', name: 'Aarong Cotton Panjabi', details: 'Category: Apparel • ৳2,800' },
    { id: 'p_organic_honey', name: 'Khaas Food Organic Sundarban Honey', details: 'Category: Food • ৳1,200' },
    { id: 'p_samsung', name: 'Samsung Galaxy S24 Ultra (BD Edition)', details: 'Category: Electronics • ৳135,000' },
    { id: 'p_kurti', name: 'Le Reve Casual Kurti', details: 'Category: Apparel • ৳1,950' },
    { id: 'p_mustard_oil', name: 'Sajeeb Mustard Oil 5L', details: 'Category: Food • ৳950' }
  ],
  brand: [
    { id: 'b_aarong', name: 'Aarong', details: 'Verified Partner • Saree, Panjabi & Crafts' },
    { id: 'b_apex', name: 'Apex Footwear', details: 'Verified Partner • Shoes & Leather Accessories' },
    { id: 'b_khaas', name: 'Khaas Food', details: 'Verified Partner • Pure & Organic Grocery' },
    { id: 'b_lereve', name: 'Le Reve', details: 'Verified Partner • Modern Fusion Apparel' },
    { id: 'b_samsung', name: 'Samsung Bangladesh', details: 'Verified Partner • Phones & Smart Appliances' }
  ],
  creator: [
    { id: 'c_mehedi', name: 'Mehedi Hasan (Tech BD)', details: 'Vlogger • 1.2M Followers • Dhaka' },
    { id: 'c_farhana', name: 'Farhana Islam (Urban Style)', details: 'Fashion Creator • 450K Followers • Banani' },
    { id: 'c_rafsan', name: 'Rafsan The ChotoBhai', details: 'Food & Lifestyle Vlogger • 3.1M Followers' },
    { id: 'c_khalid', name: 'Khalid Farhan', details: 'Marketing & Biz Creator • 800K Followers' },
    { id: 'c_tawhid', name: 'Tawhid Afridi', details: 'Vlogger & Influencer • 4.5M Followers • Gulshan' }
  ]
};

const MOCK_CREATORS = [
  { id: '1', name: 'Rifat Hasan', handle: '@rifat.h', category: 'Tech', trustScore: 98 },
  { id: '2', name: 'Nadia Islam', handle: '@nadia.style', category: 'Fashion', trustScore: 91 },
  { id: '3', name: 'Karim Khan', handle: '@karimreviews', category: 'Electronics', trustScore: 88 },
  { id: '6', name: 'Sumaiya Rahman', handle: '@sumaiya.bd', category: 'Fashion', trustScore: 96 },
  { id: '7', name: 'Tahmid Alvi', handle: '@tahmid.alvi', category: 'Tech', trustScore: 94 },
  { id: '8', name: 'Mehnaz Begum', handle: '@mehnaz.food', category: 'Food', trustScore: 87 },
];

// Hardcoded initial promotions list for Workspace 10
const INITIAL_PROMOTIONS = [
  { id: '1', name: 'Eid Collection 2025', status: 'active', hasCountdown: true, endDate: '2025-04-01', bannerUrl: '', ctaText: 'Shop Eid Collection', ctaUrl: '/promotions/eid' },
  { id: '2', name: 'Ramadan Sale', status: 'draft', hasCountdown: true, endDate: '2025-03-30', bannerUrl: '', ctaText: 'Explore Offers', ctaUrl: '/promotions/ramadan' },
  { id: '3', name: 'Summer Clearance', status: 'scheduled', hasCountdown: false, endDate: '2025-06-15', bannerUrl: '', ctaText: 'Get Deals', ctaUrl: '/promotions/summer' },
  { id: '4', name: 'Black Friday BD', status: 'draft', hasCountdown: true, endDate: '2025-11-29', bannerUrl: '', ctaText: 'See Discounts', ctaUrl: '/promotions/blackfriday' },
  { id: '5', name: '12.12 Mega Sale', status: 'draft', hasCountdown: true, endDate: '2025-12-12', bannerUrl: '', ctaText: 'View Flash Deals', ctaUrl: '/promotions/1212' },
  { id: '6', name: 'Back to School', status: 'draft', hasCountdown: false, endDate: '2025-01-10', bannerUrl: '', ctaText: 'Shop Now', ctaUrl: '/promotions/school' },
  { id: '7', name: 'New Year Offers', status: 'active', hasCountdown: false, endDate: '2025-01-01', bannerUrl: '', ctaText: 'Explore New Year', ctaUrl: '/promotions/newyear' },
  { id: '8', name: 'Valentine\'s Picks', status: 'draft', hasCountdown: false, endDate: '2025-02-14', bannerUrl: '', ctaText: 'Shop Gifts', ctaUrl: '/promotions/valentines' },
];

export default function WebsiteCMSStudio() {
  const { cmsData, updateCMSData, loading: cmsLoading } = useCMS();
  const { profile } = useAuth();
  const { addPromotion, syncToWebCampaigns } = useAds();

  // Active Workspace
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('homepage');

  // Unsaved draft status tracking
  const [hasDraftChanges, setHasDraftChanges] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // State managers initialized from context data
  const [localHeroBanners, setLocalHeroBanners] = useState<any[]>([]);
  const [localHomepageSections, setLocalHomepageSections] = useState<any[]>([]);
  const [localFooter, setLocalFooter] = useState<any>({
    description: '',
    copyrightText: '',
    columns: [],
    showPaymentIcons: true,
    showDeliveryPartners: true,
    newsletterEnabled: true
  });
  const [localSeoEntries, setLocalSeoEntries] = useState<any[]>([]);
  const [localBadges, setLocalBadges] = useState<any[]>([]);
  const [localSocialLinks, setLocalSocialLinks] = useState<any[]>([]);
  const [localAssets, setLocalAssets] = useState<any>({
    navbarLogo: '',
    footerLogo: '',
    favicon: '',
    pwaIcon: '',
    defaultProductImage: ''
  });
  const [localGlobalSettings, setLocalGlobalSettings] = useState<any>({
    websiteName: '',
    defaultCurrency: 'BDT',
    timezone: 'Asia/Dhaka',
    contactEmail: '',
    supportPhone: '',
    announcementBarText: '',
    announcementBarEnabled: true,
    maintenanceMode: false
  });
  const [localPopularSearches, setLocalPopularSearches] = useState<any[]>([]);
  const [localNav, setLocalNav] = useState<any[]>([]);

  // Promotions State (Component-local storage with fallback)
  const [localPromotions, setLocalPromotions] = useState<any[]>(() => {
    const saved = localStorage.getItem('choosify_promotional_sections');
    return saved ? JSON.parse(saved) : INITIAL_PROMOTIONS;
  });

  // Device Mode & activeTab for Live Preview Panel
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);

  // Add to component state:
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_featured_products') || '[]'); } catch { return []; }
  });
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_featured_brands') || '[]'); } catch { return []; }
  });
  const [featuredCreators, setFeaturedCreators] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_featured_creators') || '[]'); } catch { return []; }
  });
  const [featuredDeals, setFeaturedDeals] = useState<SponsoredItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_featured_deals') || '[]'); } catch { return []; }
  });
  const [spotlightBrands, setSpotlightBrands] = useState<SponsoredItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_spotlight_brands') || '[]'); } catch { return []; }
  });
  const [sponsoredItems, setSponsoredItems] = useState<SponsoredItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_sponsored') || '[]'); } catch { return []; }
  });
  const [featuredRecommendations, setFeaturedRecommendations] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_featured_recs') || '[]'); } catch { return []; }
  });
  const [recommendedBrands, setRecommendedBrands] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_recommended_brands') || '[]'); } catch { return []; }
  });
  const [recommendedProducts, setRecommendedProducts] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_recommended_products') || '[]'); } catch { return []; }
  });
  const [recommendedCreators, setRecommendedCreators] = useState<FeaturedItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('choosify_cms_recommended_creators') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('choosify_cms_featured_products', JSON.stringify(featuredProducts));
  }, [featuredProducts]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_featured_brands', JSON.stringify(featuredBrands));
  }, [featuredBrands]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_featured_creators', JSON.stringify(featuredCreators));
  }, [featuredCreators]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_featured_deals', JSON.stringify(featuredDeals));
  }, [featuredDeals]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_spotlight_brands', JSON.stringify(spotlightBrands));
  }, [spotlightBrands]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_sponsored', JSON.stringify(sponsoredItems));
  }, [sponsoredItems]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_featured_recs', JSON.stringify(featuredRecommendations));
  }, [featuredRecommendations]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_recommended_brands', JSON.stringify(recommendedBrands));
  }, [recommendedBrands]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_recommended_products', JSON.stringify(recommendedProducts));
  }, [recommendedProducts]);

  useEffect(() => {
    localStorage.setItem('choosify_cms_recommended_creators', JSON.stringify(recommendedCreators));
  }, [recommendedCreators]);

  // Track expanded banner and SEO item IDs
  const [expandedBannerId, setExpandedBannerId] = useState<string | null>(null);
  const [expandedSeoPageId, setExpandedSeoPageId] = useState<string | null>(null);
  const [expandedPromoId, setExpandedPromoId] = useState<string | null>(null);

  // Synchronize state when context finishes loading
  useEffect(() => {
    if (cmsData) {
      if (cmsData.heroBanners) setLocalHeroBanners(cmsData.heroBanners);
      if (cmsData.homepageSections) setLocalHomepageSections(cmsData.homepageSections);
      if (cmsData.footer) setLocalFooter(cmsData.footer);
      if (cmsData.seoEntries) setLocalSeoEntries(cmsData.seoEntries);
      if (cmsData.productBadges) setLocalBadges(cmsData.productBadges);
      if (cmsData.extendedSocialLinks) setLocalSocialLinks(cmsData.extendedSocialLinks);
      if (cmsData.websiteAssets) setLocalAssets(cmsData.websiteAssets);
      if (cmsData.globalSettings) setLocalGlobalSettings(cmsData.globalSettings);
      if (cmsData.popularSearches) setLocalPopularSearches(cmsData.popularSearches);
      if (cmsData.navigation) setLocalNav(cmsData.navigation);
    }
  }, [cmsData]);

  // Handle publishing all changes to Firestore
  const handlePublishAll = async () => {
    setIsPublishing(true);
    try {
      const homepagePayload = {
        id: 'default' as const,
        heroBanners: localHeroBanners.map((banner: any, idx: number) => ({
          id: String(banner.id || `hero-${idx + 1}`),
          headline: banner.headline || '',
          subtitle: banner.subtitle || '',
          ctaText: banner.ctaText || '',
          ctaUrl: banner.ctaUrl || '/products',
          backgroundImage: banner.backgroundImage || '',
          isActive: banner.isActive !== false,
          order: typeof banner.order === 'number' ? banner.order : idx,
        })),
        sections: localHomepageSections.map((section: any, idx: number) => {
          const sectionId = String(section.id || `section-${idx + 1}`);
          let itemIds: string[] = [];
          if (sectionId === 'featured-products') itemIds = featuredProducts.map((item) => item.id);
          if (sectionId === 'featured-brands') itemIds = featuredBrands.map((item) => item.id);
          if (sectionId === 'featured-deals') itemIds = featuredDeals.map((item) => item.id);
          return {
            id: sectionId,
            label: section.label || sectionId,
            isVisible: section.isVisible !== false,
            order: typeof section.order === 'number' ? section.order : idx,
            itemIds,
          };
        }),
        featuredProductIds: featuredProducts.map((item) => item.id),
        featuredBrandIds: featuredBrands.map((item) => item.id),
        featuredDealIds: featuredDeals.map((item) => item.id),
        updatedAt: new Date().toISOString(),
      };

      await updateCMSData({
        heroBanners: localHeroBanners,
        homepageSections: localHomepageSections,
        footer: localFooter,
        seoEntries: localSeoEntries,
        productBadges: localBadges,
        extendedSocialLinks: localSocialLinks,
        websiteAssets: localAssets,
        globalSettings: localGlobalSettings,
        popularSearches: localPopularSearches,
        navigation: localNav,
        cmsActivityLog: [
          createCMSLogEntry(
            profile?.displayName || profile?.email || 'Admin',
            'Published all CMS changes',
            activeWorkspace,
            '',
            'Full CMS publish'
          ),
          ...(cmsData.cmsActivityLog || []).slice(0, 49) // cap log at 50 entries
        ]
      });
      await catalogApi.updateHomepage(homepagePayload);
      localStorage.setItem('choosify_cms_featured_products', JSON.stringify(featuredProducts));
      localStorage.setItem('choosify_cms_featured_brands', JSON.stringify(featuredBrands));
      localStorage.setItem('choosify_cms_featured_creators', JSON.stringify(featuredCreators));
      localStorage.setItem('choosify_cms_featured_deals', JSON.stringify(featuredDeals));
      localStorage.setItem('choosify_cms_spotlight_brands', JSON.stringify(spotlightBrands));
      localStorage.setItem('choosify_cms_sponsored', JSON.stringify(sponsoredItems));
      localStorage.setItem('choosify_cms_featured_recs', JSON.stringify(featuredRecommendations));
      syncToWebCampaigns();
      setHasDraftChanges(false);
      showToast('✓ All featured sections and sponsored placements published!', 'success');
    } catch (err) {
      showToast('Publish failed. Please try again.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Workspace Nav Definitions
  const navigationGroups: WorkspaceGroup[] = [
    {
      label: 'CONTENT',
      items: [
        { id: 'homepage', label: 'Homepage Manager', icon: Layout },
        { id: 'hero-banners', label: 'Hero Banner Studio', icon: ImageIcon },
        { id: 'navigation', label: 'Navigation Manager', icon: Compass },
        { id: 'footer', label: 'Footer Manager', icon: Layers }
      ]
    },
    {
      label: 'DISCOVERY',
      items: [
        { id: 'search-experience', label: 'Search Experience', icon: Search },
        { id: 'product-badges', label: 'Product Badges', icon: Tag },
        { id: 'featured-products', label: 'Featured Products', icon: ShoppingBag },
        { id: 'featured-brands', label: 'Featured Brands', icon: Building2 },
        { id: 'featured-creators', label: 'Featured Creators', icon: Sparkles },
        { id: 'featured-deals', label: 'Featured Deals', icon: Zap },
        { id: 'spotlight-brands', label: 'Spotlight Brands', icon: Sparkles },
        { id: 'sponsored-ads', label: 'Sponsored Ads', icon: Megaphone },
        { id: 'sponsored-brands', label: 'Sponsored Brands', icon: Building2 },
        { id: 'sponsored-products', label: 'Sponsored Products', icon: ShoppingBag },
        { id: 'featured-recommendations', label: 'Featured Recommendations', icon: BookOpen },
        { id: 'recommended-brands', label: 'Recommended Brands', icon: Award },
        { id: 'recommended-products', label: 'Recommended Products', icon: Star },
        { id: 'recommended-creators', label: 'Recommended Creators', icon: Users }
      ]
    },
    {
      label: 'CAMPAIGNS',
      items: [
        { id: 'promotions', label: 'Promotional Sections', icon: Megaphone },
        { id: 'social-media', label: 'Social Media Manager', icon: Share2 }
      ]
    },
    {
      label: 'PLATFORM',
      items: [
        { id: 'website-assets', label: 'Website Assets', icon: Folder },
        { id: 'seo', label: 'SEO Manager', icon: Globe },
        { id: 'global-settings', label: 'Global Settings', icon: Settings }
      ]
    },
    {
      label: 'SYSTEM',
      items: [
        { id: 'activity-log', label: 'CMS Activity Log', icon: Activity }
      ]
    }
  ];

  if (cmsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text-secondary">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-app-accent" />
          <span className="text-[11px] font-black uppercase tracking-wider">Loading Website CMS Studio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text-primary p-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-app-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text-primary flex items-center gap-2">
            🌐 Website CMS Studio
            {hasDraftChanges && (
              <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Draft Changes
              </span>
            )}
          </h1>
          <p className="text-[11px] text-app-text-secondary tracking-wide">
            Manage your entire storefront from one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.open('https://choosify.bd', '_blank')}
            className="px-4 py-2 bg-white text-app-text-primary border border-app-border rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" /> Preview Website
          </button>
          <button
            onClick={() => setPreviewPanelOpen(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border ${
              previewPanelOpen
                ? 'bg-app-accent text-white border-app-accent'
                : 'bg-app-card text-app-text-secondary border-app-border hover:border-app-accent hover:text-app-accent'
            }`}
            title={previewPanelOpen ? 'Hide website preview panel' : 'Show live website preview'}
          >
            {previewPanelOpen
              ? <><PanelRightClose size={13} /> Hide Preview</>
              : <><PanelRight size={13} /> Live Preview</>
            }
          </button>
          <button 
            onClick={handlePublishAll}
            disabled={isPublishing}
            className="px-4 py-2 bg-app-accent text-white rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer hover:opacity-90 disabled:opacity-55 transition-all flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {isPublishing ? 'Publishing...' : 'Publish All Changes'}
          </button>
        </div>
      </div>

      {/* Tab Selection for narrower screens (< xl) */}
      <div className="flex xl:hidden mb-6 bg-gray-100 p-1 rounded-xl w-full max-w-xs">
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === 'edit' 
              ? 'bg-white text-app-text-primary shadow-sm font-bold' 
              : 'text-app-text-secondary hover:text-app-text-primary'
          }`}
        >
          ✍️ Edit Content
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
            activeTab === 'preview' 
              ? 'bg-white text-app-text-primary shadow-sm font-bold' 
              : 'text-app-text-secondary hover:text-app-text-primary'
          }`}
        >
          👁️ Live Preview
        </button>
      </div>

      {/* THREE COLUMN AREA */}
      <div className="flex flex-row flex-1 overflow-hidden gap-4 p-4">
        
        {/* LEFT — Workspace Navigation (always visible, fixed 220px) */}
        <aside className="w-[200px] lg:w-[220px] flex-shrink-0 bg-app-card border border-app-border rounded-xl p-3 shadow-sm overflow-y-auto self-start sticky top-6">
          <div className="space-y-5">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-2">
                  {group.label}
                </h3>
                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeWorkspace === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveWorkspace(item.id);
                          setActiveTab('edit'); // Auto switch to edit tab when selecting workspace on mobile
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-left transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-app-accent text-white shadow-sm' 
                            : 'text-app-text-secondary hover:bg-gray-100 hover:text-app-text-primary'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* MIDDLE — Edit Panel (fills all remaining space when preview is closed) */}
        <main className={`flex-1 min-w-0 overflow-y-auto bg-app-card border border-app-border rounded-xl p-5 shadow-sm min-h-[600px] transition-all duration-300`}>
          
          {/* WORKSPACE 1: Homepage Manager */}
          {activeWorkspace === 'homepage' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Homepage Manager</h2>
                  <p className="text-[11px] text-app-text-secondary">Toggle, prioritize, and manage major widgets displayed on your homepage.</p>
                </div>
              </div>

              {/* Stat Rows */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border border-app-border p-3.5 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Total Sections</div>
                  <div className="text-lg font-bold text-app-text-primary mt-1">{localHomepageSections.length}</div>
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Visible</div>
                  <div className="text-lg font-bold text-emerald-600 mt-1">
                    {localHomepageSections.filter(s => s.isVisible).length}
                  </div>
                </div>
                <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-700">Hidden</div>
                  <div className="text-lg font-bold text-rose-500 mt-1">
                    {localHomepageSections.filter(s => !s.isVisible).length}
                  </div>
                </div>
              </div>

              {/* Drag Reorder List */}
              <div className="space-y-2.5">
                {localHomepageSections
                  .sort((a, b) => a.order - b.order)
                  .map((section, idx) => (
                    <div 
                      key={section.id} 
                      className="flex items-center justify-between bg-white border border-app-border p-3 rounded-lg shadow-sm hover:shadow transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        <div>
                          <div className="text-[13px] font-bold text-app-text-primary flex items-center gap-1.5">
                            {section.label}
                            {section.isLocked && (
                              <span className="text-[9px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-app-text-secondary uppercase font-mono">ID: {section.id}</span>
                            {(() => {
                              const heroBanners = localHeroBanners;
                              const sectionContentCounts: Record<string, string> = {
                                'hero': `${heroBanners.filter(b => b.isActive).length} active banner${heroBanners.filter(b => b.isActive).length !== 1 ? 's' : ''}`,
                                'trending': `${featuredProducts.length} products`,
                                'featured-brands': `${featuredBrands.length} brands`,
                                'deals': `${featuredDeals.length} deals`,
                                'creators': `${featuredCreators.length} creators`,
                              };
                              const sectionWorkspaceMapping: Record<string, WorkspaceId> = {
                                'hero': 'hero-banners',
                                'trending': 'recommended-products',
                                'featured-brands': 'recommended-brands',
                                'deals': 'featured-deals',
                                'creators': 'recommended-creators',
                              };

                              if (section.id in sectionContentCounts) {
                                const hasZeroItems = 
                                  (section.id === 'hero' && heroBanners.filter(b => b.isActive).length === 0) ||
                                  (section.id === 'trending' && featuredProducts.length === 0) ||
                                  (section.id === 'featured-brands' && featuredBrands.length === 0) ||
                                  (section.id === 'deals' && featuredDeals.length === 0) ||
                                  (section.id === 'creators' && featuredCreators.length === 0);

                                const text = hasZeroItems ? '0 items — add content' : sectionContentCounts[section.id];
                                const className = hasZeroItems 
                                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                  : 'bg-gray-100 text-app-text-secondary hover:bg-gray-200';

                                const targetWorkspace = sectionWorkspaceMapping[section.id];

                                return (
                                  <button
                                    onClick={() => {
                                      if (targetWorkspace) {
                                        setActiveWorkspace(targetWorkspace);
                                        setActiveTab('edit');
                                      }
                                    }}
                                    className={`${className} text-[9px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-all border-none outline-none`}
                                  >
                                    {text}
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Up / Down Arrows */}
                        <div className="flex items-center gap-1">
                          <button 
                            disabled={idx === 0}
                            onClick={() => {
                              const newList = [...localHomepageSections];
                              const temp = newList[idx].order;
                              newList[idx].order = newList[idx - 1].order;
                              newList[idx - 1].order = temp;
                              setLocalHomepageSections(newList);
                              setHasDraftChanges(true);
                            }}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            disabled={idx === localHomepageSections.length - 1}
                            onClick={() => {
                              const newList = [...localHomepageSections];
                              const temp = newList[idx].order;
                              newList[idx].order = newList[idx + 1].order;
                              newList[idx + 1].order = temp;
                              setLocalHomepageSections(newList);
                              setHasDraftChanges(true);
                            }}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Visibility Toggle */}
                        <Toggle 
                          enabled={section.isVisible}
                          onChange={(val) => {
                            const updated = localHomepageSections.map(s => 
                              s.id === section.id ? { ...s, isVisible: val } : s
                            );
                            setLocalHomepageSections(updated);
                            setHasDraftChanges(true);
                          }}
                        />

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              if (section.isLocked) {
                                setActiveWorkspace('hero-banners');
                              } else {
                                showToast(`Configure widgets on dedicated sub-panels`, 'info');
                              }
                            }}
                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-app-text-primary rounded border border-app-border text-[10px] font-bold uppercase tracking-wider"
                          >
                            Edit
                          </button>
                          
                          <button 
                            disabled={section.isLocked}
                            onClick={() => {
                              const newId = `${section.id}-copy-${Date.now().toString().slice(-4)}`;
                              const newSec = {
                                ...section,
                                id: newId,
                                label: `${section.label} (Copy)`,
                                isLocked: false,
                                order: localHomepageSections.length
                              };
                              setLocalHomepageSections([...localHomepageSections, newSec]);
                              setHasDraftChanges(true);
                              showToast(`Duplicated ${section.label}`, 'success');
                            }}
                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-app-text-primary rounded border border-app-border text-[10px] font-bold uppercase tracking-wider disabled:opacity-40"
                          >
                            Duplicate
                          </button>

                          <button 
                            disabled={section.isLocked}
                            onClick={() => {
                              const updated = localHomepageSections.filter(s => s.id !== section.id);
                              setLocalHomepageSections(updated);
                              setHasDraftChanges(true);
                              showToast(`Deleted ${section.label}`, 'info');
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* WORKSPACE 2: Hero Banner Studio */}
          {activeWorkspace === 'hero-banners' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Hero Banner Studio</h2>
                  <p className="text-[11px] text-app-text-secondary">Customize visual sliding banners and CTA parameters for your home page.</p>
                </div>
                <button 
                  onClick={() => {
                    const newBanner = {
                      id: Date.now().toString(),
                      headline: 'New Launch Promo Banner',
                      subtitle: 'Enter dynamic subtitle content to appeal to Dhaka buyers.',
                      ctaText: 'Discover',
                      ctaUrl: '/products',
                      backgroundImage: '',
                      textAlignment: 'center' as const,
                      isActive: true,
                      order: localHeroBanners.length
                    };
                    setLocalHeroBanners([...localHeroBanners, newBanner]);
                    setHasDraftChanges(true);
                    setExpandedBannerId(newBanner.id);
                  }}
                  className="px-3 py-1.5 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Banner
                </button>
              </div>

              {/* Banners Grid */}
              <div className="space-y-4">
                {localHeroBanners.map((banner, index) => {
                  const isExpanded = expandedBannerId === banner.id;
                  return (
                    <div key={banner.id} className="bg-white border border-app-border rounded-xl shadow-sm overflow-hidden">
                      {/* Main row card representation */}
                      <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-app-accent bg-orange-50 px-2 py-0.5 rounded">
                              Banner #{index + 1}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              banner.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {banner.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-app-text-primary">{banner.headline}</h3>
                          <p className="text-[11px] text-app-text-secondary line-clamp-1">{banner.subtitle}</p>
                          
                          {banner.backgroundImage && (
                            <div className="text-[10px] font-mono text-gray-400 line-clamp-1">Image: {banner.backgroundImage}</div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black uppercase text-app-text-secondary bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                              CTA Button: {banner.ctaText}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setExpandedBannerId(isExpanded ? null : banner.id)}
                            className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider border border-app-border flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button 
                            onClick={() => {
                              const updated = localHeroBanners.map(b => 
                                b.id === banner.id ? { ...b, isActive: !b.isActive } : b
                              );
                              setLocalHeroBanners(updated);
                              setHasDraftChanges(true);
                            }}
                            className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider border border-app-border"
                          >
                            Toggle Active
                          </button>
                          <button 
                            onClick={() => {
                              const updated = localHeroBanners.filter(b => b.id !== banner.id);
                              setLocalHeroBanners(updated);
                              setHasDraftChanges(true);
                              showToast('Removed hero banner template', 'info');
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Form details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-app-border bg-gray-50/50 p-5 space-y-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Headline</label>
                                <input 
                                  type="text"
                                  value={banner.headline}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, headline: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Background Image URL</label>
                                <input 
                                  type="text"
                                  placeholder="https://..."
                                  value={banner.backgroundImage}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, backgroundImage: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Subtitle Content</label>
                              <textarea 
                                value={banner.subtitle}
                                rows={2}
                                onChange={(e) => {
                                  const updated = localHeroBanners.map(b => 
                                    b.id === banner.id ? { ...b, subtitle: e.target.value } : b
                                  );
                                  setLocalHeroBanners(updated);
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">CTA Button Text</label>
                                <input 
                                  type="text"
                                  value={banner.ctaText}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, ctaText: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">CTA Redirect URL</label>
                                <input 
                                  type="text"
                                  value={banner.ctaUrl}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, ctaUrl: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Text Alignment</label>
                                <div className="flex rounded-lg border border-app-border overflow-hidden bg-white">
                                  {['left', 'center', 'right'].map((align) => (
                                    <button
                                      key={align}
                                      onClick={() => {
                                        const updated = localHeroBanners.map(b => 
                                          b.id === banner.id ? { ...b, textAlignment: align as any } : b
                                        );
                                        setLocalHeroBanners(updated);
                                        setHasDraftChanges(true);
                                      }}
                                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                                        banner.textAlignment === align 
                                          ? 'bg-app-accent text-white' 
                                          : 'text-app-text-secondary hover:bg-gray-50'
                                      }`}
                                    >
                                      {align}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Active Scheduled Start Date</label>
                                <input 
                                  type="datetime-local"
                                  value={banner.startDate || ''}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, startDate: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Active Scheduled End Date</label>
                                <input 
                                  type="datetime-local"
                                  value={banner.endDate || ''}
                                  onChange={(e) => {
                                    const updated = localHeroBanners.map(b => 
                                      b.id === banner.id ? { ...b, endDate: e.target.value } : b
                                    );
                                    setLocalHeroBanners(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent transition-colors"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-2">
                              <button 
                                onClick={() => setExpandedBannerId(null)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-wider cursor-pointer hover:opacity-95"
                              >
                                Save Banner Configuration
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WORKSPACE 3: Navigation Manager */}
          {activeWorkspace === 'navigation' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Navigation Manager</h2>
                  <p className="text-[11px] text-app-text-secondary">Structure directory links for visitors to search, explore, and buy.</p>
                </div>
                <button 
                  onClick={() => {
                    const newItem = {
                      id: Date.now().toString(),
                      label: 'New Link',
                      path: '/explore',
                      order: localNav.length
                    };
                    setLocalNav([...localNav, newItem]);
                    setHasDraftChanges(true);
                  }}
                  className="px-3 py-1.5 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Menu Item
                </button>
              </div>

              {/* Editable Reorder Navigation Links */}
              <div className="space-y-2.5">
                {localNav
                  .sort((a, b) => a.order - b.order)
                  .map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-app-border p-3.5 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <div className="grid grid-cols-2 gap-4 flex-1">
                          <div>
                            <input 
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const updated = localNav.map(n => 
                                  n.id === item.id ? { ...n, label: e.target.value } : n
                                );
                                setLocalNav(updated);
                                setHasDraftChanges(true);
                              }}
                              className="w-full px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[13px] font-bold text-app-text-primary focus:outline-none focus:border-app-accent"
                            />
                          </div>
                          <div>
                            <input 
                              type="text"
                              value={item.path}
                              onChange={(e) => {
                                const updated = localNav.map(n => 
                                  n.id === item.id ? { ...n, path: e.target.value } : n
                                );
                                setLocalNav(updated);
                                setHasDraftChanges(true);
                              }}
                              className="w-full px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[11px] text-app-text-secondary font-mono focus:outline-none focus:border-app-accent"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Reorder Up / Down */}
                        <button 
                          disabled={idx === 0}
                          onClick={() => {
                            const list = [...localNav];
                            const temp = list[idx].order;
                            list[idx].order = list[idx - 1].order;
                            list[idx - 1].order = temp;
                            setLocalNav(list);
                            setHasDraftChanges(true);
                          }}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={idx === localNav.length - 1}
                          onClick={() => {
                            const list = [...localNav];
                            const temp = list[idx].order;
                            list[idx].order = list[idx + 1].order;
                            list[idx + 1].order = temp;
                            setLocalNav(list);
                            setHasDraftChanges(true);
                          }}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={localNav.length <= 1}
                          onClick={() => {
                            const updated = localNav.filter(n => n.id !== item.id);
                            setLocalNav(updated);
                            setHasDraftChanges(true);
                            showToast(`Removed menu item`, 'info');
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Strip Preview section */}
              <div className="bg-gray-50 border border-app-border rounded-xl p-4 mt-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-3">Live Navigation Menu Strip Preview</div>
                <div className="bg-white border border-app-border px-4 py-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] font-black text-slate-950 tracking-wider">CHOOSIFY.BD</span>
                    <div className="h-4 w-px bg-gray-200" />
                    <nav className="flex items-center gap-4">
                      {localNav.map(item => (
                        <span key={item.id} className="text-[11px] font-semibold text-app-text-secondary hover:text-app-accent cursor-pointer transition-colors">
                          {item.label || '(Untitled)'}
                        </span>
                      ))}
                    </nav>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-slate-900 text-white font-black px-2.5 py-1 rounded uppercase tracking-wider">Join Seller</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 4: Footer Manager */}
          {activeWorkspace === 'footer' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Footer Manager</h2>
                <p className="text-[11px] text-app-text-secondary">Govern columns, disclaimer labels, copyrights and compliance logos in the footer.</p>
              </div>

              {/* Part A: Info Form */}
              <div className="bg-white border border-app-border rounded-xl p-4 space-y-4 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary border-b border-gray-100 pb-2">Footer Info & Branding</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Description Disclaimer</label>
                    <textarea 
                      value={localFooter.description || ''}
                      rows={3}
                      onChange={(e) => {
                        setLocalFooter({ ...localFooter, description: e.target.value });
                        setHasDraftChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Copyright Text String</label>
                    <input 
                      type="text"
                      value={localFooter.copyrightText || ''}
                      onChange={(e) => {
                        setLocalFooter({ ...localFooter, copyrightText: e.target.value });
                        setHasDraftChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-gray-50 border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Part B: columns */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Footer Column Directory Maps</span>
                  <button 
                    onClick={() => {
                      const newCol = {
                        id: Date.now().toString(),
                        title: 'Support Column',
                        links: [{ label: 'Email Support', url: '/support' }]
                      };
                      setLocalFooter({
                        ...localFooter,
                        columns: [...(localFooter.columns || []), newCol]
                      });
                      setHasDraftChanges(true);
                    }}
                    className="px-2.5 py-1 border border-app-border text-app-text-primary bg-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-gray-50"
                  >
                    <Plus className="w-3 h-3" /> Add Column
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {localFooter.columns?.map((col: any, colIdx: number) => (
                    <div key={col.id} className="bg-white border border-app-border rounded-xl p-4 space-y-3 relative shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <input 
                          type="text"
                          value={col.title}
                          onChange={(e) => {
                            const newCols = [...localFooter.columns];
                            newCols[colIdx].title = e.target.value;
                            setLocalFooter({ ...localFooter, columns: newCols });
                            setHasDraftChanges(true);
                          }}
                          className="px-2 py-1 bg-gray-50 border border-app-border rounded-md text-[12px] font-black uppercase text-app-text-primary focus:outline-none"
                        />
                        <button 
                          onClick={() => {
                            const newCols = localFooter.columns.filter((c: any) => c.id !== col.id);
                            setLocalFooter({ ...localFooter, columns: newCols });
                            setHasDraftChanges(true);
                            showToast(`Deleted column ${col.title}`, 'info');
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {col.links?.map((link: any, linkIdx: number) => (
                          <div key={linkIdx} className="flex items-center gap-2">
                            <input 
                              type="text"
                              value={link.label}
                              placeholder="Link Label"
                              onChange={(e) => {
                                const newCols = [...localFooter.columns];
                                newCols[colIdx].links[linkIdx].label = e.target.value;
                                setLocalFooter({ ...localFooter, columns: newCols });
                                setHasDraftChanges(true);
                              }}
                              className="flex-1 px-2 py-1 bg-white border border-app-border rounded text-[11px] text-app-text-primary focus:outline-none"
                            />
                            <input 
                              type="text"
                              value={link.url}
                              placeholder="Path"
                              onChange={(e) => {
                                const newCols = [...localFooter.columns];
                                newCols[colIdx].links[linkIdx].url = e.target.value;
                                setLocalFooter({ ...localFooter, columns: newCols });
                                setHasDraftChanges(true);
                              }}
                              className="flex-1 px-2 py-1 bg-white border border-app-border rounded text-[10px] font-mono text-app-text-secondary focus:outline-none"
                            />
                            <button 
                              onClick={() => {
                                const newCols = [...localFooter.columns];
                                newCols[colIdx].links = newCols[colIdx].links.filter((_: any, lI: number) => lI !== linkIdx);
                                setLocalFooter({ ...localFooter, columns: newCols });
                                setHasDraftChanges(true);
                              }}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button 
                        onClick={() => {
                          const newCols = [...localFooter.columns];
                          newCols[colIdx].links.push({ label: 'New Link', url: '/' });
                          setLocalFooter({ ...localFooter, columns: newCols });
                          setHasDraftChanges(true);
                        }}
                        className="w-full text-center py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wider text-app-text-secondary"
                      >
                        + Add Link Row
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part C: footer toggles */}
              <div className="bg-white border border-app-border rounded-xl p-4 space-y-3.5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary border-b border-gray-100 pb-2">Footer Options Toggle Center</div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-bold text-app-text-primary">Show Payment Partner Icons</div>
                    <p className="text-[10px] text-app-text-secondary">Display bKash, Nagad, Visa, Mastercard compliance widgets in the sub-footer.</p>
                  </div>
                  <Toggle 
                    enabled={localFooter.showPaymentIcons}
                    onChange={(val) => {
                      setLocalFooter({ ...localFooter, showPaymentIcons: val });
                      setHasDraftChanges(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-bold text-app-text-primary">Show Delivery Logistics Badges</div>
                    <p className="text-[10px] text-app-text-secondary">Render standard redx, paperfly, and pathao visual logistics banners.</p>
                  </div>
                  <Toggle 
                    enabled={localFooter.showDeliveryPartners}
                    onChange={(val) => {
                      setLocalFooter({ ...localFooter, showDeliveryPartners: val });
                      setHasDraftChanges(true);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-bold text-app-text-primary">Newsletter Subscription Box Enabled</div>
                    <p className="text-[10px] text-app-text-secondary">Embed global email collection fields for customer product campaign outreach.</p>
                  </div>
                  <Toggle 
                    enabled={localFooter.newsletterEnabled}
                    onChange={(val) => {
                      setLocalFooter({ ...localFooter, newsletterEnabled: val });
                      setHasDraftChanges(true);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 5: Search Experience */}
          {activeWorkspace === 'search-experience' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Search Experience</h2>
                  <p className="text-[11px] text-app-text-secondary">Govern popular keywords recommended to clients when interacting with the search system.</p>
                </div>
                <button 
                  onClick={() => {
                    const newSearch = {
                      id: Date.now().toString(),
                      term: 'BD Cotton Silk Saree',
                      order: localPopularSearches.length,
                      isActive: true
                    };
                    setLocalPopularSearches([...localPopularSearches, newSearch]);
                    setHasDraftChanges(true);
                  }}
                  className="px-3 py-1.5 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Search Term
                </button>
              </div>

              {/* Popular list reorder */}
              <div className="space-y-2.5">
                {localPopularSearches
                  .sort((a, b) => a.order - b.order)
                  .map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-app-border p-3 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <input 
                          type="text"
                          value={item.term}
                          onChange={(e) => {
                            const updated = localPopularSearches.map(p => 
                              p.id === item.id ? { ...p, term: e.target.value } : p
                            );
                            setLocalPopularSearches(updated);
                            setHasDraftChanges(true);
                          }}
                          className="w-full md:w-1/2 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <Toggle 
                          enabled={item.isActive}
                          onChange={(val) => {
                            const updated = localPopularSearches.map(p => 
                              p.id === item.id ? { ...p, isActive: val } : p
                            );
                            setLocalPopularSearches(updated);
                            setHasDraftChanges(true);
                          }}
                        />

                        <div className="flex items-center gap-1">
                          <button 
                            disabled={idx === 0}
                            onClick={() => {
                              const list = [...localPopularSearches];
                              const temp = list[idx].order;
                              list[idx].order = list[idx - 1].order;
                              list[idx - 1].order = temp;
                              setLocalPopularSearches(list);
                              setHasDraftChanges(true);
                            }}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            disabled={idx === localPopularSearches.length - 1}
                            onClick={() => {
                              const list = [...localPopularSearches];
                              const temp = list[idx].order;
                              list[idx].order = list[idx + 1].order;
                              list[idx + 1].order = temp;
                              setLocalPopularSearches(list);
                              setHasDraftChanges(true);
                            }}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button 
                          onClick={() => {
                            const updated = localPopularSearches.filter(p => p.id !== item.id);
                            setLocalPopularSearches(updated);
                            setHasDraftChanges(true);
                            showToast(`Deleted ${item.term}`, 'info');
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Strip Preview section */}
              <div className="bg-gray-50 border border-app-border rounded-xl p-4 mt-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-3">How it looks on website (Active Searches)</div>
                <div className="bg-white border border-app-border px-4 py-3 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-lg bg-gray-50">
                    <Search className="w-4 h-4 text-gray-400" />
                    <span className="text-[11px] text-gray-400 font-medium">Search Aarong, Apex, Le Reve and 100+ trusted brands...</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Popular:</span>
                    {localPopularSearches
                      .filter(t => t.isActive)
                      .map(p => (
                        <span key={p.id} className="text-[10px] bg-orange-50 text-app-accent border border-orange-100 px-2.5 py-1 rounded-full font-bold cursor-pointer hover:bg-orange-100 transition-colors">
                          {p.term || '(Empty term)'}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 6: Product Badges Manager */}
          {activeWorkspace === 'product-badges' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Product Badges Manager</h2>
                  <p className="text-[11px] text-app-text-secondary">Create and manage visual tags applied on verified product cards.</p>
                </div>
                <button 
                  onClick={() => {
                    const newBadge = {
                      id: Date.now().toString(),
                      label: 'Premium Spec',
                      color: '#4F46E5',
                      icon: 'Star',
                      priority: localBadges.length + 1,
                      isActive: true
                    };
                    setLocalBadges([...localBadges, newBadge]);
                    setHasDraftChanges(true);
                  }}
                  className="px-3 py-1.5 bg-app-accent text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Badge
                </button>
              </div>

              {/* 3-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {localBadges.map((badge) => (
                  <div key={badge.id} className="bg-white border border-app-border rounded-xl p-4 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        {/* Live Pill Preview */}
                        <span 
                          style={{ backgroundColor: badge.color }}
                          className="px-2.5 py-1 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-sm"
                        >
                          <Sparkles className="w-3 h-3" /> {badge.label || 'Badge Label'}
                        </span>
                        
                        <Toggle 
                          enabled={badge.isActive}
                          onChange={(val) => {
                            const updated = localBadges.map(b => 
                              b.id === badge.id ? { ...b, isActive: val } : b
                            );
                            setLocalBadges(updated);
                            setHasDraftChanges(true);
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Badge Label</label>
                          <input 
                            type="text"
                            value={badge.label}
                            onChange={(e) => {
                              const updated = localBadges.map(b => 
                                b.id === badge.id ? { ...b, label: e.target.value } : b
                              );
                              setLocalBadges(updated);
                              setHasDraftChanges(true);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[11px] font-bold text-app-text-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Pick Color</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="color"
                                value={badge.color.startsWith('#') ? badge.color : '#000000'}
                                onChange={(e) => {
                                  const updated = localBadges.map(b => 
                                    b.id === badge.id ? { ...b, color: e.target.value } : b
                                  );
                                  setLocalBadges(updated);
                                  setHasDraftChanges(true);
                                }}
                                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                              />
                              <input 
                                type="text"
                                value={badge.color}
                                onChange={(e) => {
                                  const updated = localBadges.map(b => 
                                    b.id === badge.id ? { ...b, color: e.target.value } : b
                                  );
                                  setLocalBadges(updated);
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-1.5 py-1 text-[10px] font-mono border border-app-border rounded bg-white text-center"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Priority No.</label>
                            <input 
                              type="number"
                              value={badge.priority}
                              onChange={(e) => {
                                const updated = localBadges.map(b => 
                                  b.id === badge.id ? { ...b, priority: parseInt(e.target.value) || 0 } : b
                                );
                                setLocalBadges(updated);
                                setHasDraftChanges(true);
                              }}
                              className="w-full px-2 py-1 bg-gray-50 border border-app-border rounded text-[11px] font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-gray-100">
                      <button 
                        onClick={() => {
                          const updated = localBadges.filter(b => b.id !== badge.id);
                          setLocalBadges(updated);
                          setHasDraftChanges(true);
                          showToast(`Removed badge`, 'info');
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WORKSPACE 7, 8, 9: Featured Items Workspace */}
          {activeWorkspace === 'featured-products' && (
            <FeaturedItemsWorkspace 
              title="Featured Products Manager" 
              itemType="product" 
              storageKey="choosify_featured_products" 
              onDraftStateChange={() => setHasDraftChanges(true)}
            />
          )}

          {activeWorkspace === 'featured-brands' && (
            <FeaturedItemsWorkspace 
              title="Featured Brands Spotlight" 
              itemType="brand" 
              storageKey="choosify_featured_brands" 
              onDraftStateChange={() => setHasDraftChanges(true)}
            />
          )}

          {activeWorkspace === 'featured-creators' && (
            <FeaturedItemsWorkspace 
              title="Featured Creators Feed" 
              itemType="creator" 
              storageKey="choosify_featured_creators" 
              onDraftStateChange={() => setHasDraftChanges(true)}
            />
          )}

          {/* NEW REUSABLE DISCOVERY AND SPONSOR WORKSPACES */}
          {activeWorkspace === 'featured-deals' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 text-orange-900 rounded-xl p-3 text-[11px] font-medium flex items-center gap-2">
                <span>⚡</span>
                <span>Items added here will appear in the flash deals strip. Enable countdown to show a live timer on each deal.</span>
              </div>
              <EntityPickerWorkspace
                title="Featured Deals"
                subtitle="Choose deals to feature on the homepage flash deals strip"
                icon={Zap}
                entityType="product"
                sponsorMode={true}
                sponsorType="sponsored_deal"
                items={featuredDeals}
                onItemsChange={items => { setFeaturedDeals(items); localStorage.setItem('choosify_cms_featured_deals', JSON.stringify(items)); }}
                placementId="deals_section"
                showToast={showToast}
                setHasDraftChanges={setHasDraftChanges}
              />
            </div>
          )}

          {activeWorkspace === 'spotlight-brands' && (
            <EntityPickerWorkspace
              title="Spotlight Brands"
              subtitle="Choose brands for the homepage spotlight brand carousel"
              icon={Sparkles}
              entityType="brand"
              sponsorMode={true}
              sponsorType="spotlight_brand"
              items={spotlightBrands}
              onItemsChange={items => { setSpotlightBrands(items); localStorage.setItem('choosify_cms_spotlight_brands', JSON.stringify(items)); }}
              placementId="spotlight_section"
              maxItems={8}
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'sponsored-ads' && (
            <EntityPickerWorkspace
              title="Sponsored Campaigns Manager"
              subtitle="All sponsored products, brands, and promotions in a unified view."
              icon={Megaphone}
              entityType="product"
              sponsorMode={true}
              items={sponsoredItems}
              onItemsChange={items => { setSponsoredItems(items); localStorage.setItem('choosify_cms_sponsored', JSON.stringify(items)); }}
              placementId="homepage_sponsored_ads"
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
              sponsoredAdsMode={true}
            />
          )}

          {activeWorkspace === 'sponsored-brands' && (
            <EntityPickerWorkspace
              title="Sponsored Brands"
              subtitle="Brands paying for sponsored placement on category and search pages"
              icon={Building2}
              entityType="brand"
              sponsorMode={true}
              sponsorType="sponsored_brand"
              items={sponsoredItems.filter(i => i.sponsorType === 'sponsored_brand')}
              onItemsChange={updated => {
                const others = sponsoredItems.filter(i => i.sponsorType !== 'sponsored_brand');
                const next = [...others, ...updated];
                setSponsoredItems(next);
                localStorage.setItem('choosify_cms_sponsored', JSON.stringify(next));
              }}
              placementId="sponsored_listing"
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'sponsored-products' && (
            <EntityPickerWorkspace
              title="Sponsored Products"
              subtitle="Products paying for sponsored placement"
              icon={ShoppingBag}
              entityType="product"
              sponsorMode={true}
              sponsorType="sponsored_product"
              items={sponsoredItems.filter(i => i.sponsorType === 'sponsored_product')}
              onItemsChange={updated => {
                const others = sponsoredItems.filter(i => i.sponsorType !== 'sponsored_product');
                const next = [...others, ...updated];
                setSponsoredItems(next);
                localStorage.setItem('choosify_cms_sponsored', JSON.stringify(next));
              }}
              placementId="category_top"
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'featured-recommendations' && (
            <EntityPickerWorkspace
              title="Featured Recommendations & Guides"
              subtitle="Pin expert buying guides to the homepage recommendations section"
              icon={BookOpen}
              entityType="guide"
              sponsorMode={false}
              items={featuredRecommendations}
              onItemsChange={items => { setFeaturedRecommendations(items); localStorage.setItem('choosify_cms_featured_recs', JSON.stringify(items)); }}
              placementId="recommended_section"
              maxItems={6}
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'recommended-brands' && (
            <EntityPickerWorkspace
              title="Choosify Recommended Brands"
              subtitle="Brands the Choosify editorial team recommends — shown in the Recommended section"
              icon={Award}
              entityType="brand"
              sponsorMode={false}
              items={featuredBrands}
              onItemsChange={items => { setFeaturedBrands(items); localStorage.setItem('choosify_cms_featured_brands', JSON.stringify(items)); }}
              placementId="featured_brands"
              maxItems={10}
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'recommended-products' && (
            <EntityPickerWorkspace
              title="Recommended Products"
              subtitle="Products Choosify editorially recommends — shown in the Recommended For You section"
              icon={Star}
              entityType="product"
              sponsorMode={false}
              items={featuredProducts}
              onItemsChange={items => { setFeaturedProducts(items); localStorage.setItem('choosify_cms_featured_products', JSON.stringify(items)); }}
              placementId="recommended_section"
              maxItems={12}
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {activeWorkspace === 'recommended-creators' && (
            <EntityPickerWorkspace
              title="Recommended Creators"
              subtitle="Creators Choosify recommends — shown in the Featured Creators section"
              icon={Users}
              entityType="creator"
              sponsorMode={false}
              items={featuredCreators}
              onItemsChange={items => { setFeaturedCreators(items); localStorage.setItem('choosify_cms_featured_creators', JSON.stringify(items)); }}
              placementId="featured_creators"
              maxItems={8}
              showToast={showToast}
              setHasDraftChanges={setHasDraftChanges}
            />
          )}

          {/* WORKSPACE 10: Promotional Sections */}
          {activeWorkspace === 'promotions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Promotional Sections</h2>
                  <p className="text-[11px] text-app-text-secondary">Track, edit, and coordinate grand campaign sections (Eid, Winter, Ramadan) with countdown clocks.</p>
                </div>
              </div>

              {/* Promotions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {localPromotions.map((promo) => {
                  const isExpanded = expandedPromoId === promo.id;
                  
                  // Days remaining calculation
                  const getCountdown = (dateStr: string) => {
                    const diff = new Date(dateStr).getTime() - new Date().getTime();
                    if (diff <= 0) return 'Ended';
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return `${days} Days Remaining`;
                  };

                  return (
                    <div key={promo.id} className="bg-white border border-app-border rounded-xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            promo.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            promo.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {promo.status}
                          </span>

                          {promo.hasCountdown && (
                            <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              Countdown: {getCountdown(promo.endDate)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-app-text-primary">{promo.name}</h3>
                        <p className="text-[10px] text-app-text-secondary font-mono">End Limit: {promo.endDate}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <button 
                          onClick={() => setExpandedPromoId(isExpanded ? null : promo.id)}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-app-border text-app-text-primary rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Edit Campaign
                        </button>

                        <button 
                          onClick={async () => {
                            try {
                              await addPromotion({
                                type: 'DEAL',
                                title: promo.name,
                                subtitle: promo.ctaText || 'Campaign Special Deal',
                                imageUrl: promo.bannerUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
                                linkUrl: promo.ctaUrl || '#',
                                status: promo.status === 'active' ? 'ACTIVE' : promo.status === 'scheduled' ? 'SCHEDULED' : 'INACTIVE',
                                startDate: new Date().toISOString().split('T')[0],
                                endDate: promo.endDate,
                                placement: 'homepage_banner',
                                targeting: ['General'],
                                priority: 5
                              });
                              showToast('Campaign successfully pushed to Ads & Promotions context!', 'success');
                            } catch (err: any) {
                              showToast(`Failed to push campaign: ${err.message}`, 'error');
                            }
                          }}
                          className="px-3 py-1.5 bg-app-accent hover:bg-app-accent/90 text-white rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Megaphone className="w-3 h-3" /> Push to Ads
                        </button>
                      </div>

                      {/* Expand form */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="col-span-full border border-app-border bg-gray-50/50 p-4 mt-3 rounded-lg space-y-3 w-full"
                          >
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Campaign Name</label>
                              <input 
                                type="text"
                                value={promo.name}
                                onChange={(e) => {
                                  const updated = localPromotions.map(p => 
                                    p.id === promo.id ? { ...p, name: e.target.value } : p
                                  );
                                  setLocalPromotions(updated);
                                  localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Campaign Status</label>
                                <select 
                                  value={promo.status}
                                  onChange={(e) => {
                                    const updated = localPromotions.map(p => 
                                      p.id === promo.id ? { ...p, status: e.target.value } : p
                                    );
                                    setLocalPromotions(updated);
                                    localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-2 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                                >
                                  <option value="draft">Draft</option>
                                  <option value="active">Active</option>
                                  <option value="scheduled">Scheduled</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Countdown Enable</label>
                                <div className="pt-1.5">
                                  <Toggle 
                                    enabled={promo.hasCountdown}
                                    onChange={(val) => {
                                      const updated = localPromotions.map(p => 
                                        p.id === promo.id ? { ...p, hasCountdown: val } : p
                                      );
                                      setLocalPromotions(updated);
                                      localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                      setHasDraftChanges(true);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">CTA Label</label>
                                <input 
                                  type="text"
                                  value={promo.ctaText || ''}
                                  onChange={(e) => {
                                    const updated = localPromotions.map(p => 
                                      p.id === promo.id ? { ...p, ctaText: e.target.value } : p
                                    );
                                    setLocalPromotions(updated);
                                    localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Redirect Path</label>
                                <input 
                                  type="text"
                                  value={promo.ctaUrl || ''}
                                  onChange={(e) => {
                                    const updated = localPromotions.map(p => 
                                      p.id === promo.id ? { ...p, ctaUrl: e.target.value } : p
                                    );
                                    setLocalPromotions(updated);
                                    localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Banner Hero URL</label>
                              <input 
                                type="text"
                                placeholder="https://..."
                                value={promo.bannerUrl || ''}
                                onChange={(e) => {
                                  const updated = localPromotions.map(p => 
                                    p.id === promo.id ? { ...p, bannerUrl: e.target.value } : p
                                  );
                                  setLocalPromotions(updated);
                                  localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Campaign Closing Date</label>
                              <input 
                                type="date"
                                value={promo.endDate}
                                onChange={(e) => {
                                  const updated = localPromotions.map(p => 
                                    p.id === promo.id ? { ...p, endDate: e.target.value } : p
                                  );
                                  setLocalPromotions(updated);
                                  localStorage.setItem('choosify_promotional_sections', JSON.stringify(updated));
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-app-border rounded-lg text-[11px]"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button 
                                onClick={() => setExpandedPromoId(null)}
                                className="px-3 py-1 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer"
                              >
                                Save campaign
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WORKSPACE 11: Social Media Manager */}
          {activeWorkspace === 'social-media' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Social Media Manager</h2>
                <p className="text-[11px] text-app-text-secondary">Update company social media paths embedded on consumer web layouts.</p>
              </div>

              {/* Platforms Row List */}
              <div className="space-y-3">
                {localSocialLinks
                  .sort((a, b) => a.order - b.order)
                  .map((link, idx) => {
                    const emojis: Record<string, string> = {
                      Facebook: '📘', Instagram: '📸', WhatsApp: '💬',
                      TikTok: '🎵', YouTube: '▶️', LinkedIn: '💼', Telegram: '✈️'
                    };
                    const emoji = emojis[link.platform] || '🔗';

                    return (
                      <div key={link.id} className="flex items-center justify-between bg-white border border-app-border p-3.5 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3 flex-1 mr-4">
                          <span className="text-xl shrink-0">{emoji}</span>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <span className="text-[13px] font-bold text-app-text-primary self-center">{link.platform}</span>
                            <input 
                              type="text"
                              value={link.url}
                              placeholder={`https://${link.platform.toLowerCase()}.com/choosify`}
                              onChange={(e) => {
                                const updated = localSocialLinks.map(s => 
                                  s.id === link.id ? { ...s, url: e.target.value } : s
                                );
                                setLocalSocialLinks(updated);
                                setHasDraftChanges(true);
                              }}
                              className="md:col-span-2 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Toggle 
                            enabled={link.isVisible}
                            onChange={(val) => {
                              const updated = localSocialLinks.map(s => 
                                s.id === link.id ? { ...s, isVisible: val } : s
                              );
                              setLocalSocialLinks(updated);
                              setHasDraftChanges(true);
                            }}
                          />

                          <div className="flex items-center">
                            <button 
                              disabled={idx === 0}
                              onClick={() => {
                                const list = [...localSocialLinks];
                                const temp = list[idx].order;
                                list[idx].order = list[idx - 1].order;
                                list[idx - 1].order = temp;
                                setLocalSocialLinks(list);
                                setHasDraftChanges(true);
                              }}
                              className="p-1 text-gray-500 disabled:opacity-35"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              disabled={idx === localSocialLinks.length - 1}
                              onClick={() => {
                                const list = [...localSocialLinks];
                                const temp = list[idx].order;
                                list[idx].order = list[idx + 1].order;
                                list[idx + 1].order = temp;
                                setLocalSocialLinks(list);
                                setHasDraftChanges(true);
                              }}
                              className="p-1 text-gray-500 disabled:opacity-35"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* WORKSPACE 12: Website Assets */}
          {activeWorkspace === 'website-assets' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Website Assets</h2>
                <p className="text-[11px] text-app-text-secondary">Govern vector logos, icons, default product mock assets served to browsers.</p>
              </div>

              {/* Rows layout */}
              <div className="space-y-4">
                {[
                  { key: 'navbarLogo', label: 'Navbar Header Logo', desc: 'Sits at top left corner of customer browsing headers.' },
                  { key: 'footerLogo', label: 'Footer Brand Logo', desc: 'Large high-contrast display branding vector for footers.' },
                  { key: 'favicon', label: 'Tab Favicon (.ico)', desc: 'Webpage tab indicator badge displayed by client web engines.' },
                  { key: 'pwaIcon', label: 'PWA Shortcut Logo (192x192)', desc: 'Mobile homescreen overlay graphics for Progressive Web applications.' },
                  { key: 'defaultProductImage', label: 'Default Product Placeholder', desc: 'Mock graphics shown if a brand forgets to supply an item cover.' }
                ].map((asset) => {
                  const val = localAssets[asset.key] || '';
                  return (
                    <div key={asset.key} className="bg-white border border-app-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        {/* 64x64 Preview */}
                        <div className="w-16 h-16 rounded-lg bg-gray-50 border border-app-border overflow-hidden shrink-0 flex items-center justify-center">
                          {val ? (
                            <img src={val} alt="preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-300" />
                          )}
                        </div>

                        <div className="space-y-1 flex-1">
                          <h4 className="text-[13px] font-bold text-app-text-primary">{asset.label}</h4>
                          <p className="text-[10px] text-app-text-secondary">{asset.desc}</p>
                          <input 
                            type="text"
                            placeholder="https://images.unsplash.com/... or relative path"
                            value={val}
                            onChange={(e) => {
                              const updated = { ...localAssets, [asset.key]: e.target.value };
                              setLocalAssets(updated);
                              setHasDraftChanges(true);
                            }}
                            className="w-full px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[11px] mt-1.5 focus:outline-none focus:border-app-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <button 
                          onClick={() => {
                            const updated = { ...localAssets, [asset.key]: '' };
                            setLocalAssets(updated);
                            setHasDraftChanges(true);
                            showToast(`Cleared ${asset.label}`, 'info');
                          }}
                          className="px-2.5 py-1.5 bg-red-50 text-red-500 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WORKSPACE 13: SEO Manager */}
          {activeWorkspace === 'seo' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">SEO Metadata Manager</h2>
                <p className="text-[11px] text-app-text-secondary">Govern page titles, meta snippets, keywords, and og images for search index bots.</p>
              </div>

              {/* Editable listings */}
              <div className="space-y-4">
                {localSeoEntries.map((seo) => {
                  const isExpanded = expandedSeoPageId === seo.pageId;
                  
                  // Character limit counters
                  const titleCount = seo.title?.length || 0;
                  const descCount = seo.metaDescription?.length || 0;

                  return (
                    <div key={seo.pageId} className="bg-white border border-app-border rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 flex items-center justify-between gap-4 flex-col sm:flex-row">
                        <div>
                          <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {seo.pageLabel}
                          </span>
                          <h4 className="text-[13px] font-bold text-app-text-primary mt-1">{seo.title || '(No Title Entered)'}</h4>
                          <p className="text-[10px] font-mono text-app-text-secondary truncate max-w-md">URL: {seo.canonicalUrl}</p>
                        </div>

                        <button 
                          onClick={() => setExpandedSeoPageId(isExpanded ? null : seo.pageId)}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-app-border text-app-text-primary rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"
                        >
                          <Pencil className="w-3 h-3" /> Edit SEO Meta
                        </button>
                      </div>

                      {/* Expandable editor */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-app-border bg-gray-50/50 p-5 space-y-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Meta Title</label>
                                  <span className={`text-[10px] font-black ${
                                    titleCount >= 60 ? 'text-red-500 font-black' : titleCount >= 48 ? 'text-amber-500 font-bold' : 'text-gray-400'
                                  }`}>
                                    {titleCount}/60 chars
                                  </span>
                                </div>
                                <input 
                                  type="text"
                                  value={seo.title}
                                  onChange={(e) => {
                                    const updated = localSeoEntries.map(s => 
                                      s.pageId === seo.pageId ? { ...s, title: e.target.value } : s
                                    );
                                    setLocalSeoEntries(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Keywords (comma-separated)</label>
                                <input 
                                  type="text"
                                  value={seo.keywords}
                                  onChange={(e) => {
                                    const updated = localSeoEntries.map(s => 
                                      s.pageId === seo.pageId ? { ...s, keywords: e.target.value } : s
                                    );
                                    setLocalSeoEntries(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px]"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Meta Description</label>
                                <span className={`text-[10px] font-black ${
                                  descCount >= 160 ? 'text-red-500 font-black' : descCount >= 128 ? 'text-amber-500 font-bold' : 'text-gray-400'
                                }`}>
                                  {descCount}/160 chars
                                </span>
                              </div>
                              <textarea 
                                value={seo.metaDescription}
                                rows={2}
                                onChange={(e) => {
                                  const updated = localSeoEntries.map(s => 
                                    s.pageId === seo.pageId ? { ...s, metaDescription: e.target.value } : s
                                  );
                                  setLocalSeoEntries(updated);
                                  setHasDraftChanges(true);
                                }}
                                className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">OG Image URL</label>
                                <input 
                                  type="text"
                                  placeholder="https://..."
                                  value={seo.ogImage}
                                  onChange={(e) => {
                                    const updated = localSeoEntries.map(s => 
                                      s.pageId === seo.pageId ? { ...s, ogImage: e.target.value } : s
                                    );
                                    setLocalSeoEntries(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px]"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary mb-1 block">Canonical URL Link</label>
                                <input 
                                  type="text"
                                  value={seo.canonicalUrl}
                                  onChange={(e) => {
                                    const updated = localSeoEntries.map(s => 
                                      s.pageId === seo.pageId ? { ...s, canonicalUrl: e.target.value } : s
                                    );
                                    setLocalSeoEntries(updated);
                                    setHasDraftChanges(true);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-app-border rounded-lg text-[12px]"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end pt-2">
                              <button 
                                onClick={() => setExpandedSeoPageId(null)}
                                className="px-3.5 py-1.5 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-wider"
                              >
                                Save SEO Params
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WORKSPACE 14: Global Settings */}
          {activeWorkspace === 'global-settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">Global Website Settings</h2>
                <p className="text-[11px] text-app-text-secondary">Toggle maintenance blockades, set currencies and update announcement scripts.</p>
              </div>

              {localGlobalSettings.maintenanceMode && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                  ⚠️ Maintenance Mode is ON — website is offline to visitors
                </div>
              )}

              {/* SettingRows */}
              <div className="bg-white border border-app-border rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
                
                {/* Website Name */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">Website Name</div>
                    <p className="text-[10px] text-app-text-secondary">Main title parsed by search crawlers and browser headers.</p>
                  </div>
                  <input 
                    type="text"
                    value={localGlobalSettings.websiteName || ''}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, websiteName: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-64 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>

                {/* Currency */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">Default Currency</div>
                    <p className="text-[10px] text-app-text-secondary">System-wide core currency applied on merchant product tags.</p>
                  </div>
                  <select 
                    value={localGlobalSettings.defaultCurrency || 'BDT'}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, defaultCurrency: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-64 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                {/* Timezone */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">System Timezone</div>
                    <p className="text-[10px] text-app-text-secondary">Used to coordinate product sale countdown triggers accurately.</p>
                  </div>
                  <select 
                    value={localGlobalSettings.timezone || 'Asia/Dhaka'}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, timezone: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-64 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  >
                    <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (GMT+5.5)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                  </select>
                </div>

                {/* Contact Email */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">Official Contact Email</div>
                    <p className="text-[10px] text-app-text-secondary">Primary support mailbox published for brand and creator outreach.</p>
                  </div>
                  <input 
                    type="email"
                    value={localGlobalSettings.contactEmail || ''}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, contactEmail: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-64 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>

                {/* Support Phone */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">Official Helpline Phone</div>
                    <p className="text-[10px] text-app-text-secondary">Customer support helpline number shown in header banners.</p>
                  </div>
                  <input 
                    type="text"
                    value={localGlobalSettings.supportPhone || ''}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, supportPhone: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-64 px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>

                {/* Announcement Bar text */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1 pr-4">
                    <div className="text-[12px] font-bold text-app-text-primary">Announcement Bar Content</div>
                    <p className="text-[10px] text-app-text-secondary">Banner line sitting at absolute top of client browser tabs.</p>
                  </div>
                  <input 
                    type="text"
                    value={localGlobalSettings.announcementBarText || ''}
                    onChange={(e) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, announcementBarText: e.target.value });
                      setHasDraftChanges(true);
                    }}
                    className="w-full md:w-[350px] px-2.5 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>

                {/* Announcement Bar Enabled */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary">Announcement Bar Active</div>
                    <p className="text-[10px] text-app-text-secondary">Toggle to show or hide the top announcement strip.</p>
                  </div>
                  <Toggle 
                    enabled={localGlobalSettings.announcementBarEnabled}
                    onChange={(val) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, announcementBarEnabled: val });
                      setHasDraftChanges(true);
                    }}
                  />
                </div>

                {/* Maintenance Mode */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[12px] font-bold text-app-text-primary text-red-500">Lock Maintenance Mode</div>
                    <p className="text-[10px] text-app-text-secondary">Take storefront offline entirely, rendering safety placeholders to browsers.</p>
                  </div>
                  <Toggle 
                    enabled={localGlobalSettings.maintenanceMode}
                    onChange={(val) => {
                      setLocalGlobalSettings({ ...localGlobalSettings, maintenanceMode: val });
                      setHasDraftChanges(true);
                    }}
                  />
                </div>

              </div>
            </div>
          )}

          {/* WORKSPACE 15: CMS Activity Log */}
          {activeWorkspace === 'activity-log' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">CMS Activity Log</h2>
                  <p className="text-[11px] text-app-text-secondary">Browse historical logs detailing system modifications pushed by authorized administrators.</p>
                </div>

                {(cmsData.cmsActivityLog && cmsData.cmsActivityLog.length > 0) && (
                  <button 
                    onClick={() => {
                      // Simple CSV exporter helper
                      const headers = ['Timestamp', 'Admin', 'Workspace', 'Action', 'Previous Value', 'New Value'];
                      const rows = (cmsData.cmsActivityLog || []).map(log => [
                        log.timestamp,
                        log.adminName,
                        log.workspace,
                        log.action,
                        log.previousValue.replace(/"/g, '""'),
                        log.newValue.replace(/"/g, '""')
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `choosify_cms_log_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      showToast('CSV downloaded successfully!', 'success');
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    Export Log (CSV)
                  </button>
                )}
              </div>

              {(!cmsData.cmsActivityLog || cmsData.cmsActivityLog.length === 0) ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-app-border rounded-xl text-app-text-secondary text-center space-y-3">
                  <Activity className="w-12 h-12 text-gray-300 stroke-[1.5]" />
                  <div>
                    <h4 className="text-[13px] font-bold text-app-text-primary">No CMS changes recorded yet</h4>
                    <p className="text-[10px] text-app-text-secondary max-w-xs mx-auto mt-1">When any admin publishes edits, audit records will stream here instantly.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-app-border rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-app-border text-[9px] font-black uppercase tracking-widest text-app-text-secondary">
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Admin</th>
                        <th className="px-4 py-3">Workspace</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3 text-right">Rollback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {cmsData.cmsActivityLog.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3.5 text-app-text-secondary font-mono">
                            {new Date(log.timestamp).toLocaleString('en-US', { hour12: true })}
                          </td>
                          <td className="px-4 py-3.5 text-app-text-primary font-bold">
                            {log.adminName}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="bg-orange-50 text-app-accent border border-orange-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                              {log.workspace}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-app-text-primary font-semibold">
                            {log.action}
                          </td>
                          <td className="px-4 py-3.5 text-app-text-secondary max-w-xs truncate">
                            {log.newValue || log.previousValue || 'Full publish trigger'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button 
                              onClick={() => showToast('Rollback requires backend connection. Coming soon.', 'info')}
                              className="text-app-accent hover:underline text-[10px] font-black uppercase tracking-wider"
                            >
                              Rollback
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>

        {/* RIGHT — Live Preview Panel (slides in/out, 380px, does not push content — overlays) */}
        <AnimatePresence>
          {(previewPanelOpen || activeTab === 'preview') && (
            <motion.section
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className={`flex-shrink-0 bg-app-card border border-app-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${
                previewPanelOpen ? 'w-[340px] lg:w-[380px]' : 'w-0 overflow-hidden'
              }`}
            >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-app-border pb-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-app-text-primary flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-app-accent" /> Live Preview
            </h3>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  deviceMode === 'desktop' 
                    ? 'bg-white text-app-text-primary shadow-sm font-bold' 
                    : 'text-app-text-secondary hover:text-app-text-primary'
                }`}
              >
                🖥 Desktop
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  deviceMode === 'mobile' 
                    ? 'bg-white text-app-text-primary shadow-sm font-bold' 
                    : 'text-app-text-secondary hover:text-app-text-primary'
                }`}
              >
                📱 Mobile
              </button>
            </div>
          </div>

          {/* Mini browser frame container */}
          <div className="bg-gray-100 rounded-xl p-2 border border-gray-200">
            {/* Top browser bar */}
            <div className="flex items-center gap-2 mb-2 px-1.5">
              <div className="flex gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-400 block" />
                <span className="w-2 h-2 rounded-full bg-amber-400 block" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
              </div>
              <div className="flex-1 bg-white rounded-md border border-gray-200 text-center text-[9px] font-mono text-gray-400 py-0.5 select-none">
                choosify.bd
              </div>
            </div>

            {/* Scale wrapper and Phone Frame wrapper */}
            {deviceMode === 'mobile' ? (
              <div className="w-[200px] mx-auto border-[6px] border-gray-800 rounded-[28px] overflow-hidden shadow-2xl bg-white relative">
                {/* Simulated Notch */}
                <div className="absolute top-0 inset-x-0 h-3 bg-gray-800 rounded-b-md flex justify-center items-center z-10">
                  <div className="w-12 h-1 rounded-full bg-black" />
                </div>
                <div className="pt-3 max-h-[500px] overflow-y-auto bg-white custom-scrollbar">
                  <HomepagePreview
                    heroBanners={localHeroBanners}
                    homepageSections={localHomepageSections}
                    globalSettings={localGlobalSettings}
                    featuredProducts={featuredProducts}
                    featuredBrands={featuredBrands}
                    featuredCreators={featuredCreators}
                    featuredDeals={featuredDeals}
                    spotlightBrands={spotlightBrands}
                    sponsoredItems={sponsoredItems}
                    popularSearches={localPopularSearches}
                    deviceMode="mobile"
                    activeWorkspace={activeWorkspace}
                    localFooter={localFooter}
                  />
                </div>
              </div>
            ) : (
              <div className="overflow-hidden bg-white border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto custom-scrollbar relative" style={{ height: '480px' }}>
                <div style={{ transform: 'scale(0.72)', transformOrigin: 'top left', width: '138.9%' }}>
                  <HomepagePreview
                    heroBanners={localHeroBanners}
                    homepageSections={localHomepageSections}
                    globalSettings={localGlobalSettings}
                    featuredProducts={featuredProducts}
                    featuredBrands={featuredBrands}
                    featuredCreators={featuredCreators}
                    featuredDeals={featuredDeals}
                    spotlightBrands={spotlightBrands}
                    sponsoredItems={sponsoredItems}
                    popularSearches={localPopularSearches}
                    deviceMode="desktop"
                    activeWorkspace={activeWorkspace}
                    localFooter={localFooter}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* TOAST SYSTEM POPUP */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[200] px-5 py-3.5 rounded-xl shadow-2xl text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2.5 ${
              toast.type === 'success' ? 'bg-emerald-600' : 
              toast.type === 'error' ? 'bg-red-500' : 'bg-app-accent'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- SHARED INTERNAL COMPONENT FOR FEATURED ITEMS (WORKSPACE 7, 8, 9) ---
interface FeaturedItemsWorkspaceProps {
  title: string;
  itemType: 'product' | 'brand' | 'creator';
  storageKey: string;
  onDraftStateChange: () => void;
}

function FeaturedItemsWorkspace({ title, itemType, storageKey, onDraftStateChange }: FeaturedItemsWorkspaceProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [items, setItems] = useState<any[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

  const { profiles } = useBrandProfiles();

  // Save on state change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  // Query pool of local seed items dynamically with fallbacks
  const queryPool = (() => {
    let list: any[] = [];
    if (itemType === 'product') {
      const storedProducts = JSON.parse(localStorage.getItem('choosify_products') || '[]');
      if (storedProducts.length > 0) {
        list = storedProducts.map((p: any) => ({
          id: String(p.id),
          name: p.name,
          details: `Brand: ${p.brand || 'Unknown'} • Category: ${p.category || 'General'} • ৳${p.price || '0'}`
        }));
      }
    } else if (itemType === 'brand') {
      if (profiles && profiles.length > 0) {
        list = profiles.map((b: any) => ({
          id: String(b.id),
          name: b.name,
          details: `${b.badge || 'Brand Profile'} • Category: ${b.category || 'General'} • Industry: ${b.industry || 'N/A'}`
        }));
      }
    } else if (itemType === 'creator') {
      list = MOCK_CREATORS.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        details: `Handle: ${c.handle} • Category: ${c.category} • Trust Score: ${c.trustScore}%`
      }));
    }

    if (list.length === 0) {
      list = SEARCHABLE_ITEMS[itemType] || [];
    }
    return list;
  })();
  const filteredResults = searchTerm.trim() === '' 
    ? [] 
    : queryPool.filter(it => 
        it.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !items.some(existing => existing.id === it.id)
      );

  // Sorting: Pinned items always show up first
  const sortedItems = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0; // maintain relative array positions
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider">{title}</h2>
        <p className="text-[11px] text-app-text-secondary">Search, pin, and reorder curated {itemType} items highlighted across our storefront portal.</p>
      </div>

      {/* Search Input Area */}
      <div className="relative space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">Search {itemType}s to feature</label>
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <input 
            type="text"
            placeholder={`Type to search e.g. ${queryPool[0]?.name || ''}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-app-border rounded-lg text-[12px] font-medium text-app-text-primary focus:outline-none focus:border-app-accent"
          />
        </div>

        {/* Dropdown list of results */}
        <AnimatePresence>
          {filteredResults.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute z-50 left-0 right-0 bg-white border border-app-border rounded-xl shadow-xl overflow-hidden divide-y divide-gray-100"
            >
              {filteredResults.map((result) => (
                <div 
                  key={result.id}
                  onClick={() => {
                    const newItem = {
                      id: result.id,
                      name: result.name,
                      details: result.details,
                      pinned: false,
                      order: items.length
                    };
                    setItems([...items, newItem]);
                    setSearchTerm('');
                    onDraftStateChange();
                  }}
                  className="p-3 hover:bg-orange-50/40 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-[12px] font-bold text-app-text-primary">{result.name}</div>
                    <div className="text-[10px] text-app-text-secondary font-mono">{result.details}</div>
                  </div>
                  <Plus className="w-4 h-4 text-app-accent" />
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Featured List */}
      <div className="space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary border-b border-gray-100 pb-2">
          Current Featured List ({items.length} items)
        </div>

        {items.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-app-border rounded-xl text-app-text-secondary text-[11px]">
            No items added to featured showcase yet. Type in the box above to find and add.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedItems.map((item, idx) => {
              // Get original index in array
              const originalIdx = items.findIndex(x => x.id === item.id);
              return (
                <div 
                  key={item.id} 
                  className={`flex items-center justify-between bg-white border p-3.5 rounded-lg shadow-sm ${
                    item.pinned ? 'border-orange-200 bg-orange-50/10' : 'border-app-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-[13px] font-bold text-app-text-primary flex items-center gap-2">
                        {item.name}
                        {item.pinned && (
                          <span className="text-[9px] bg-app-accent text-white font-black px-1.5 py-0.5 rounded uppercase tracking-widest flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-current" /> Pinned
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-app-text-secondary font-mono uppercase">{item.details}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Pin button */}
                    <button 
                      onClick={() => {
                        const updated = items.map(x => 
                          x.id === item.id ? { ...x, pinned: !x.pinned } : x
                        );
                        setItems(updated);
                        onDraftStateChange();
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        item.pinned 
                          ? 'bg-orange-50 border-orange-200 text-app-accent' 
                          : 'bg-white border-app-border text-app-text-secondary hover:bg-gray-50'
                      }`}
                    >
                      Pin Item
                    </button>

                    {/* Order buttons */}
                    <div className="flex items-center">
                      <button 
                        disabled={idx === 0}
                        onClick={() => {
                          const prevItem = sortedItems[idx - 1];
                          const realIdxPrev = items.findIndex(x => x.id === prevItem.id);
                          const updated = [...items];
                          const temp = updated[originalIdx];
                          updated[originalIdx] = updated[realIdxPrev];
                          updated[realIdxPrev] = temp;
                          setItems(updated);
                          onDraftStateChange();
                        }}
                        className="p-1 text-gray-500 disabled:opacity-35"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        disabled={idx === sortedItems.length - 1}
                        onClick={() => {
                          const nextItem = sortedItems[idx + 1];
                          const realIdxNext = items.findIndex(x => x.id === nextItem.id);
                          const updated = [...items];
                          const temp = updated[originalIdx];
                          updated[originalIdx] = updated[realIdxNext];
                          updated[realIdxNext] = temp;
                          setItems(updated);
                          onDraftStateChange();
                        }}
                        className="p-1 text-gray-500 disabled:opacity-35"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button 
                      onClick={() => {
                        const updated = items.filter(x => x.id !== item.id);
                        setItems(updated);
                        onDraftStateChange();
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- LIVE COUNTDOWN TIMER FOR TIMED DEALS ---
const LiveCountdown = ({ endDate }: { endDate: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(endDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <span className="font-mono text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded tracking-wider animate-pulse flex items-center gap-1">
      ⏱ {timeLeft}
    </span>
  );
};

// --- CORE REUSABLE ENTITY PICKER WORKSPACE ---
interface EntityPickerWorkspaceProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  entityType: 'product' | 'brand' | 'creator' | 'guide';
  sponsorMode: boolean; // false = simple featured, true = sponsored with dates/price config
  sponsorType?: SponsoredItem['sponsorType'];
  items: (FeaturedItem | SponsoredItem)[];
  onItemsChange: (items: any[]) => void;
  maxItems?: number; // default 12
  placementId: string; // maps to AdsContext Promotion.placement
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  setHasDraftChanges?: (val: boolean) => void;
  sponsoredAdsMode?: boolean; // If true, enables specialized tab filters and multiple "Add" buttons
}

function EntityPickerWorkspace({
  title,
  subtitle,
  icon: Icon,
  entityType,
  sponsorMode,
  sponsorType,
  items,
  onItemsChange,
  maxItems = 12,
  placementId,
  showToast = () => {},
  setHasDraftChanges = () => {},
  sponsoredAdsMode = false,
}: EntityPickerWorkspaceProps) {
  const { addPromotion, deletePromotion, updatePromotion, promotions } = useAds();
  const { profiles: brandProfiles } = useBrandProfiles();

  // Dynamic state for active entity type, sponsor type, and placement when picking/adding
  const [currentEntityType, setCurrentEntityType] = useState<'product' | 'brand' | 'creator' | 'guide'>(entityType);
  const [currentSponsorType, setCurrentSponsorType] = useState<SponsoredItem['sponsorType'] | undefined>(sponsorType);
  const [currentPlacementId, setCurrentPlacementId] = useState<string>(placementId);

  // Tab filter state for general-purpose sponsored manager
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'sponsored_product' | 'sponsored_brand' | 'sponsored_recommendation'>('all');

  const getPlacementForSponsorType = (type: string) => {
    if (type === 'sponsored_deal') return 'deals_section';
    if (type === 'spotlight_brand') return 'spotlight_section';
    if (type === 'sponsored_brand') return 'sponsored_listing';
    if (type === 'sponsored_product') return 'category_top';
    if (type === 'sponsored_recommendation') return 'homepage_sponsored_ads';
    return 'homepage_sponsored_ads';
  };

  // Panel state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityForConfig, setSelectedEntityForConfig] = useState<any | null>(null);
  const [configMode, setConfigMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Keep state in sync with props when props change (except when picker is open or in custom multi-type mode)
  useEffect(() => {
    if (!pickerOpen && !sponsoredAdsMode) {
      setCurrentEntityType(entityType);
      setCurrentSponsorType(sponsorType);
      setCurrentPlacementId(placementId);
    }
  }, [entityType, sponsorType, placementId, pickerOpen, sponsoredAdsMode]);

  // Configuration fields state
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [priority, setPriority] = useState(50);
  const [isTimedDeal, setIsTimedDeal] = useState(false);
  const [dealPrice, setDealPrice] = useState<number>(0);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [hasCountdown, setHasCountdown] = useState(false);
  const [spotlightStyle, setSpotlightStyle] = useState('card');

  // Query and Search pool
  const queryPool = (() => {
    if (currentEntityType === 'product') {
      const storedProducts = JSON.parse(localStorage.getItem('choosify_products') || '[]');
      const hardcodedProducts = [
        { id: 'p1', name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', category: 'Mobile & Gadgets', price: 124999, image: '' },
        { id: 'p2', name: 'Apex Leather Derby Shoes', brand: 'Apex', category: 'Fashion & Footwear', price: 3500, image: '' },
        { id: 'p3', name: 'Aarong Cotton Panjabi - Eid Edition', brand: 'Aarong', category: 'Fashion & Clothing', price: 2800, image: '' },
        { id: 'p4', name: 'Walton Frost-R WFD-2B5 Refrigerator', brand: 'Walton', category: 'Home Appliances', price: 45000, image: '' },
        { id: 'p5', name: 'Bata Comfit Slip-On', brand: 'Bata', category: 'Fashion & Footwear', price: 1800, image: '' },
        { id: 'p6', name: 'Mi 10000mAh Power Bank', brand: 'Xiaomi', category: 'Mobile & Gadgets', price: 1299, image: '' },
        { id: 'p7', name: 'Meena Bazar Organic Rice 5kg', brand: 'Meena Bazar', category: 'Food & Grocery', price: 380, image: '' },
        { id: 'p8', name: 'Perfume - Oud Bengal Intense', brand: 'Sailor', category: 'Beauty & Grooming', price: 1700, image: '' },
      ];
      const allProductsMap = new Map();
      hardcodedProducts.forEach(p => allProductsMap.set(p.id, p));
      storedProducts.forEach((p: any) => allProductsMap.set(String(p.id), { ...p, id: String(p.id) }));
      return Array.from(allProductsMap.values());
    } else if (currentEntityType === 'brand') {
      return brandProfiles || [];
    } else if (currentEntityType === 'creator') {
      return MOCK_CREATORS;
    } else if (currentEntityType === 'guide') {
      return JSON.parse(localStorage.getItem('choosify_guides_studio_list') || '[]');
    }
    return [];
  })();

  const searchResults = searchQuery.trim() === ''
    ? []
    : queryPool.filter((entity: any) => {
        const queryLower = searchQuery.toLowerCase();
        if (currentEntityType === 'product') {
          return entity.name.toLowerCase().includes(queryLower) || (entity.brand || '').toLowerCase().includes(queryLower);
        } else if (currentEntityType === 'brand') {
          return entity.name.toLowerCase().includes(queryLower) || (entity.category || '').toLowerCase().includes(queryLower);
        } else if (currentEntityType === 'creator') {
          return entity.name.toLowerCase().includes(queryLower) || (entity.category || '').toLowerCase().includes(queryLower);
        } else if (currentEntityType === 'guide') {
          return (
            (entity.guideTitle || '').toLowerCase().includes(queryLower) ||
            (entity.authorName || '').toLowerCase().includes(queryLower) ||
            (entity.category || '').toLowerCase().includes(queryLower)
          );
        }
        return false;
      });

  const handleAddFeatured = (entity: any) => {
    const newItem: FeaturedItem = {
      id: entity.id,
      name: entity.name || entity.guideTitle || '',
      image: entity.image || entity.logo || entity.authorAvatar || '',
      brand: entity.brand || entity.industry || '',
      category: entity.category || '',
      price: entity.price,
      type: currentEntityType,
      isPinned: false,
      addedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items.filter(i => i.id !== entity.id)].slice(0, maxItems);
    onItemsChange(updated);
    setHasDraftChanges(true);
    showToast(`${entity.name || entity.guideTitle} added to ${title}!`);
    setPickerOpen(false);
    setSearchQuery('');
  };

  const handleOpenConfigForAdd = (entity: any) => {
    setSelectedEntityForConfig(entity);
    setConfigMode('add');
    setEditingItem(null);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPriority(50);
    setIsTimedDeal(false);
    setDealPrice(entity.price || 0);
    setOriginalPrice(entity.price || 0);
    setHasCountdown(false);
    setSpotlightStyle('card');
  };

  const handleOpenConfigForEdit = (item: any) => {
    const originalEntity = queryPool.find((q: any) => String(q.id) === String(item.id)) || item;
    setSelectedEntityForConfig(originalEntity);
    setConfigMode('edit');
    setEditingItem(item);
    setStartDate(item.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(item.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setPriority(item.priority || 50);
    setIsTimedDeal(item.isTimedDeal || false);
    setDealPrice(item.dealPrice || item.price || 0);
    setOriginalPrice(item.originalPrice || item.price || 0);
    setHasCountdown(item.hasCountdown || false);
    setSpotlightStyle(item.spotlightStyle || 'card');
    
    // Set dynamic entity and sponsor type state for editing config matching
    setCurrentEntityType(item.type);
    setCurrentSponsorType(item.sponsorType);
    setCurrentPlacementId(item.sponsorType ? getPlacementForSponsorType(item.sponsorType) : placementId);
    
    setPickerOpen(true);
  };

  const handleAddSponsored = async () => {
    if (!selectedEntityForConfig) return;
    const entity = selectedEntityForConfig;

    try {
      if (configMode === 'add') {
        // 1. Create the Promotion in AdsContext
        await addPromotion({
          type: currentEntityType === 'product' ? 'PRODUCT' : currentEntityType === 'brand' ? 'BRAND' : 'RECOMMENDATION',
          targetId: entity.id,
          title: entity.name || entity.guideTitle || '',
          subtitle: `${currentSponsorType?.replace(/_/g, ' ')} via Website CMS Studio`,
          imageUrl: entity.image || entity.logo || '',
          status: 'ACTIVE',
          startDate: startDate,
          endDate: endDate,
          placement: currentPlacementId,
          targeting: entity.category ? [entity.category] : [],
          priority: priority,
        });

        // 2. Add to local list
        const newItem: SponsoredItem = {
          id: entity.id,
          name: entity.name || entity.guideTitle || '',
          image: entity.image || entity.logo || '',
          brand: entity.brand || entity.industry || '',
          category: entity.category || '',
          price: isTimedDeal ? dealPrice : entity.price,
          originalPrice: originalPrice || entity.price,
          type: currentEntityType,
          sponsorType: currentSponsorType!,
          startDate: startDate,
          endDate: endDate,
          hasCountdown: hasCountdown || false,
          isTimedDeal: isTimedDeal || false,
          dealPrice: isTimedDeal ? dealPrice : undefined,
          isPinned: false,
          addedAt: new Date().toISOString(),
          spotlightStyle: currentEntityType === 'brand' ? spotlightStyle : undefined,
        };

        onItemsChange([newItem, ...items.filter(i => i.id !== entity.id)]);
        showToast(`✓ ${entity.name || entity.guideTitle} added as ${currentSponsorType?.replace(/_/g, ' ')} and synced to Ads Manager!`);
      } else {
        // Edit Mode
        // 1. Update matching Promotion in AdsContext if it exists
        const matchingPromo = promotions.find(p => p.targetId === entity.id && p.placement === currentPlacementId);
        if (matchingPromo) {
          await updatePromotion(matchingPromo.id, {
            startDate: startDate,
            endDate: endDate,
            priority: priority,
            title: entity.name || entity.guideTitle || '',
          });
        }

        // 2. Update local list
        const updated = items.map((i: any) => {
          if (i.id === entity.id) {
            return {
              ...i,
              startDate: startDate,
              endDate: endDate,
              priority: priority,
              isTimedDeal: isTimedDeal,
              dealPrice: isTimedDeal ? dealPrice : undefined,
              originalPrice: originalPrice,
              price: isTimedDeal ? dealPrice : (originalPrice || i.price),
              hasCountdown: hasCountdown,
              spotlightStyle: currentEntityType === 'brand' ? spotlightStyle : undefined,
            };
          }
          return i;
        });
        onItemsChange(updated);
        showToast(`✓ Updated config for ${entity.name || entity.guideTitle}!`);
      }

      setHasDraftChanges(true);
      setPickerOpen(false);
      setSelectedEntityForConfig(null);
      setSearchQuery('');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (sponsorMode) {
      const targetItem = items.find(i => i.id === id) as any;
      const targetPlacement = targetItem?.sponsorType ? getPlacementForSponsorType(targetItem.sponsorType) : placementId;
      const matchingPromo = promotions.find(p => p.targetId === id && p.placement === targetPlacement);
      if (matchingPromo) {
        await deletePromotion(matchingPromo.id);
      }
    }
    const updated = items.filter(i => i.id !== id);
    onItemsChange(updated);
    setHasDraftChanges(true);
    showToast(`Removed ${name} from ${title}`);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    onItemsChange(updated);
    setHasDraftChanges(true);
  };

  const handleTogglePin = (id: string) => {
    const updated = items.map(i => {
      if (i.id === id) {
        return { ...i, isPinned: !i.isPinned };
      }
      return i;
    });
    onItemsChange(updated);
    setHasDraftChanges(true);
  };

  const handleSyncToAdsContext = async () => {
    try {
      showToast(`Syncing ${title} campaigns...`, 'info');
      for (const item of items) {
        const itemPlacement = (item as any).sponsorType ? getPlacementForSponsorType((item as any).sponsorType) : placementId;
        const matchingPromo = promotions.find(p => p.targetId === item.id && p.placement === itemPlacement);
        if (!matchingPromo) {
          await addPromotion({
            type: item.type === 'product' ? 'PRODUCT' : item.type === 'brand' ? 'BRAND' : 'RECOMMENDATION',
            targetId: item.id,
            title: item.name,
            subtitle: `${(item as any).sponsorType?.replace(/_/g, ' ') || sponsorType?.replace(/_/g, ' ')} via Website CMS Studio`,
            imageUrl: item.image || '',
            status: 'ACTIVE',
            startDate: (item as any).startDate || new Date().toISOString().split('T')[0],
            endDate: (item as any).endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            placement: itemPlacement,
            targeting: item.category ? [item.category] : [],
            priority: (item as any).priority || 50,
          });
        }
      }
      showToast(`✓ Synced all items to AdsContext!`, 'success');
    } catch (err: any) {
      showToast(`Sync failed: ${err.message}`, 'error');
    }
  };

  // Filter and Sorting
  const filteredItems = sponsoredAdsMode
    ? (activeTabFilter === 'all' ? items : items.filter((i: any) => i.sponsorType === activeTabFilter))
    : items;

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const activeCount = items.length;
  const pinnedCount = items.filter(i => i.isPinned).length;

  return (
    <div className="relative overflow-hidden min-h-[550px] space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-app-border pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-app-accent">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
              {title}
            </h2>
            <p className="text-[11px] text-app-text-secondary">{subtitle}</p>
          </div>
        </div>
        
        {sponsoredAdsMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setCurrentEntityType('product');
                setCurrentSponsorType('sponsored_product');
                setCurrentPlacementId('category_top');
                setSelectedEntityForConfig(null);
                setSearchQuery('');
                setConfigMode('add');
                setPickerOpen(true);
              }}
              className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Sponsored Product
            </button>
            <button
              onClick={() => {
                setCurrentEntityType('brand');
                setCurrentSponsorType('sponsored_brand');
                setCurrentPlacementId('sponsored_listing');
                setSelectedEntityForConfig(null);
                setSearchQuery('');
                setConfigMode('add');
                setPickerOpen(true);
              }}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Sponsored Brand
            </button>
            <button
              onClick={() => {
                setCurrentEntityType('product');
                setCurrentSponsorType('sponsored_recommendation');
                setCurrentPlacementId('homepage_sponsored_ads');
                setSelectedEntityForConfig(null);
                setSearchQuery('');
                setConfigMode('add');
                setPickerOpen(true);
              }}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Sponsored Rec
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setSelectedEntityForConfig(null);
              setSearchQuery('');
              setConfigMode('add');
              setPickerOpen(true);
            }}
            className="px-3.5 py-2 bg-app-accent text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:opacity-95 flex items-center gap-1 cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-4 h-4" /> Add {entityType === 'guide' ? 'Guide' : entityType.charAt(0).toUpperCase() + entityType.slice(1)}
          </button>
        )}
      </div>

      {/* SUB-TYPE TAB FILTERS FOR SPONSORED ADS */}
      {sponsoredAdsMode && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-app-border pb-3">
          {[
            { id: 'all', label: 'All Sponsored' },
            { id: 'sponsored_product', label: 'Sponsored Products' },
            { id: 'sponsored_brand', label: 'Sponsored Brands' },
            { id: 'sponsored_recommendation', label: 'Sponsored Recommendations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border ${
                activeTabFilter === tab.id
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-app-text-secondary border-app-border hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* STATS AND SYNC */}
      <div className="flex items-center justify-between bg-gray-50/50 border border-app-border p-3 rounded-lg text-[11px] font-bold text-app-text-secondary">
        <div className="flex items-center gap-4">
          <span>Active: <span className="text-app-text-primary font-black">{activeCount}</span> / {maxItems}</span>
          <span>Pinned: <span className="text-orange-500 font-black">{pinnedCount}</span></span>
        </div>
        {sponsorMode && (
          <button
            onClick={handleSyncToAdsContext}
            className="text-app-accent hover:underline flex items-center gap-1 uppercase tracking-wider text-[10px]"
          >
            Publish to AdsContext ▶
          </button>
        )}
      </div>

      {/* CURRENT ITEMS LIST */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-app-text-secondary">
          Currently Curated
        </h3>

        {sortedItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-app-border rounded-xl text-app-text-secondary text-[11px] space-y-2">
            <p>No items assigned to this section yet.</p>
            {sponsoredAdsMode ? (
              <p className="text-[10px] text-gray-400">Click one of the sponsored add buttons above to start curating.</p>
            ) : (
              <button
                onClick={() => {
                  setSelectedEntityForConfig(null);
                  setSearchQuery('');
                  setConfigMode('add');
                  setPickerOpen(true);
                }}
                className="text-app-accent hover:underline uppercase font-black"
              >
                + Click here to curate your first entity
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item, idx) => {
              const originalIndex = items.findIndex(x => x.id === item.id);
              const isItemSponsored = sponsorMode && (item as any).startDate;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-3.5 bg-white border rounded-xl shadow-sm hover:shadow transition-all ${
                    item.isPinned ? 'border-orange-200 bg-orange-50/5' : 'border-app-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Order Controls */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <button
                        disabled={originalIndex === 0}
                        onClick={() => handleMove(originalIndex, 'up')}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-500"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={originalIndex === items.length - 1}
                        onClick={() => handleMove(originalIndex, 'down')}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 text-gray-500"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Image Thumbnail */}
                    {item.image ? (
                      <img
                        src={item.image}
                        referrerPolicy="no-referrer"
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover border border-app-border shrink-0 bg-gray-50"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg text-gray-400 font-bold shrink-0 border border-app-border">
                        {item.type === 'product' || (!item.type && currentEntityType === 'product') ? '📦' : 
                         item.type === 'brand' || (!item.type && currentEntityType === 'brand') ? '🛡️' : 
                         item.type === 'creator' || (!item.type && currentEntityType === 'creator') ? '✨' : '📖'}
                      </div>
                    )}

                    {/* Meta Text */}
                    <div className="space-y-1">
                      <div className="text-[12px] font-black text-app-text-primary flex flex-wrap items-center gap-1.5 leading-none">
                        <span>{item.name}</span>
                        {item.isPinned && (
                          <span className="text-[8px] bg-orange-500 text-white font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wider">
                            📌 Pinned
                          </span>
                        )}
                        {isItemSponsored && (
                          <span className="text-[8px] bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {(item as any).sponsorType?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-app-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
                        {item.brand && <span className="font-semibold text-gray-600">Brand: {item.brand}</span>}
                        {item.category && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">{item.category}</span>}
                        {item.price && <span className="text-orange-500 font-extrabold font-mono">৳{item.price}</span>}
                      </div>

                      {/* Sponsored dates and badges */}
                      {isItemSponsored && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[9px] text-gray-500 font-bold">
                            📅 {(item as any).startDate} → {(item as any).endDate}
                          </span>
                          <span className="text-[9px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-black">
                            Priority: {(item as any).priority}
                          </span>
                          {(item as any).isTimedDeal && (
                            <LiveCountdown endDate={(item as any).endDate} />
                          )}
                          {(item as any).spotlightStyle && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-100 uppercase tracking-widest">
                              Style: {(item as any).spotlightStyle}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => handleTogglePin(item.id)}
                      className={`px-2 py-1 border rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                        item.isPinned
                          ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                          : 'bg-white text-app-text-secondary border-app-border hover:bg-gray-50'
                      }`}
                    >
                      Pin
                    </button>
                    {sponsorMode && (
                      <button
                        onClick={() => handleOpenConfigForEdit(item)}
                        className="px-2 py-1 bg-white border border-app-border text-indigo-600 hover:bg-indigo-50 rounded text-[9px] font-black uppercase tracking-wider"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(item.id, item.name)}
                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[9px] font-black uppercase tracking-wider border border-transparent"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SLIDE-IN RIGHT DRAWER / PICKER PANEL */}
      <AnimatePresence>
        {pickerOpen && (
          <>
            {/* Backdrop cover for edit panel scope */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setPickerOpen(false)}
              className="absolute inset-0 bg-black z-40 rounded-xl"
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[310px] sm:w-[360px] bg-white border-l border-app-border shadow-2xl z-50 p-4 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header of Picker */}
                <div className="flex items-center justify-between border-b border-app-border pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text-primary flex items-center gap-1">
                    {configMode === 'add' ? `Add ${entityType}` : `Edit Configuration`}
                  </h3>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar (Add Mode only) */}
                {configMode === 'add' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary">
                      🔍 Search {entityType}s
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder={`Search ${entityType}s...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-app-border rounded-lg text-[11px] font-semibold text-app-text-primary focus:outline-none focus:border-app-accent"
                      />
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {configMode === 'add' && searchResults.length > 0 && (
                  <div className="max-h-[160px] overflow-y-auto border border-app-border rounded-lg divide-y divide-gray-100 bg-gray-50">
                    {searchResults.map((entity: any) => {
                      const isAdded = items.some(i => i.id === entity.id);
                      return (
                        <div key={entity.id} className="p-2.5 flex items-center justify-between gap-2 text-[10px]">
                          <div className="min-w-0">
                            <div className="font-bold text-app-text-primary truncate">{entity.name || entity.guideTitle}</div>
                            <div className="text-[8.5px] text-app-text-secondary font-mono truncate">
                              {entity.brand || entity.industry || entity.category || entity.handle || ''}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (sponsorMode) {
                                handleOpenConfigForAdd(entity);
                              } else {
                                handleAddFeatured(entity);
                              }
                            }}
                            className={`px-2 py-1 rounded font-bold uppercase tracking-wider shrink-0 border ${
                              isAdded
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-orange-50 border-orange-200 text-app-accent hover:bg-orange-100'
                            }`}
                            disabled={isAdded}
                          >
                            {isAdded ? 'Curated' : '+ Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SPONSOR/PLACEMENT PLUG CONFIGURATION PANEL */}
                {selectedEntityForConfig && (
                  <div className="bg-orange-50/30 border border-orange-100 rounded-xl p-3.5 space-y-3">
                    <div className="border-b border-orange-100 pb-1.5 mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-800">
                        ⚙️ Configure Campaign
                      </span>
                      <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-black uppercase">
                        {selectedEntityForConfig.name || selectedEntityForConfig.guideTitle}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-0.5">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-app-border rounded-md text-[10px] font-semibold text-app-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block mb-0.5">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-app-border rounded-md text-[10px] font-semibold text-app-text-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary">
                          Ad Priority Weight
                        </label>
                        <span className="text-[10px] text-app-accent font-black font-mono">{priority}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={priority}
                        onChange={(e) => setPriority(parseInt(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-app-accent"
                      />
                    </div>

                    {/* Product Specific Timed Deal */}
                    {entityType === 'product' && (
                      <div className="border-t border-orange-100/60 pt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] font-bold text-gray-700">Set as Timed Flash Deal</span>
                          <Toggle enabled={isTimedDeal} onChange={setIsTimedDeal} />
                        </div>

                        {isTimedDeal && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-2 pt-1"
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[8px] font-black uppercase text-app-text-secondary block mb-0.5">
                                  Deal Price (৳)
                                </label>
                                <input
                                  type="number"
                                  value={dealPrice}
                                  onChange={(e) => setDealPrice(parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 bg-white border border-app-border rounded-md text-[10px] font-bold"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase text-app-text-secondary block mb-0.5">
                                  Original Price (৳)
                                </label>
                                <input
                                  type="number"
                                  value={originalPrice}
                                  onChange={(e) => setOriginalPrice(parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1 bg-white border border-app-border rounded-md text-[10px] font-bold text-gray-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[9px] text-gray-500 font-bold">Show Countdown Timer</span>
                              <Toggle enabled={hasCountdown} onChange={setHasCountdown} />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Brand Specific Layout style */}
                    {entityType === 'brand' && (
                      <div className="border-t border-orange-100/60 pt-2.5 space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-app-text-secondary block">
                          Spotlight Layout Style
                        </label>
                        <select
                          value={spotlightStyle}
                          onChange={(e) => setSpotlightStyle(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-app-border rounded-md text-[10px] font-bold text-app-text-primary focus:outline-none"
                        >
                          <option value="card">Card Style</option>
                          <option value="banner">Banner Style</option>
                          <option value="logo_strip">Logo Strip Style</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Actions Footer */}
              {selectedEntityForConfig && (
                <div className="border-t border-app-border pt-3 mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedEntityForConfig(null);
                      if (configMode === 'edit') setPickerOpen(false);
                    }}
                    className="flex-1 py-2 border border-app-border text-app-text-secondary hover:bg-gray-50 rounded-lg text-[10px] font-black uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSponsored}
                    className="flex-1 py-2 bg-app-accent hover:opacity-95 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                  >
                    Confirm Campaign
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- HOMEPAGE PREVIEW PANEL COMPONENT ---
interface HomepagePreviewProps {
  heroBanners: any[];
  homepageSections: any[];
  globalSettings: any;
  featuredProducts: any[];
  featuredBrands: any[];
  featuredCreators: any[];
  featuredDeals: any[];
  spotlightBrands: any[];
  sponsoredItems: any[];
  popularSearches: any[];
  deviceMode: 'desktop' | 'mobile';
  activeWorkspace: WorkspaceId;
  localFooter: any;
}

function HomepagePreview({
  heroBanners,
  homepageSections,
  globalSettings,
  featuredProducts,
  featuredBrands,
  featuredCreators,
  featuredDeals,
  spotlightBrands,
  sponsoredItems,
  popularSearches,
  deviceMode,
  activeWorkspace,
  localFooter
}: HomepagePreviewProps) {
  const { profiles: brandProfiles } = useBrandProfiles();

  // Helper to check section visibility
  const isSectionVisible = (id: string) => {
    const sec = homepageSections.find(s => s.id === id);
    return sec ? sec.isVisible : true;
  };

  // Section highlight mapping
  const isSectionHighlighted = (id: string) => {
    if (activeWorkspace === 'hero-banners' && id === 'hero') return true;
    if (activeWorkspace === 'search-experience' && id === 'categories') return true;
    if (activeWorkspace === 'featured-products' && id === 'trending') return true;
    if (activeWorkspace === 'spotlight-brands' && id === 'spotlight') return true;
    if ((activeWorkspace === 'sponsored-ads' || activeWorkspace === 'sponsored-products' || activeWorkspace === 'sponsored-brands') && id === 'sponsored') return true;
    if ((activeWorkspace === 'promotions' || activeWorkspace === 'featured-deals') && id === 'deals') return true;
    if (activeWorkspace === 'featured-brands' && id === 'featured-brands') return true;
    if (activeWorkspace === 'featured-creators' && id === 'creators') return true;
    return false;
  };

  // Resolve spotlight brands
  const activeSpotlights = spotlightBrands && spotlightBrands.length > 0 
    ? spotlightBrands 
    : (brandProfiles && brandProfiles.length > 0 
        ? brandProfiles.slice(0, 4) 
        : [
            { id: '1', name: 'Aarong', category: 'Fashion' },
            { id: '2', name: 'Apex', category: 'Footwear' },
            { id: '3', name: 'Khaas Food', category: 'Organic' },
            { id: '4', name: 'Le Reve', category: 'Apparel' }
          ]);

  // Resolve sponsored products
  const displaySponsoredProducts = sponsoredItems && sponsoredItems.length > 0
    ? sponsoredItems.filter(item => item.sponsorType === 'sponsored_product' || item.type === 'PRODUCT').slice(0, 3)
    : [
        { id: 's1', title: 'Eid Special Kurti', subtitle: 'Flat 20% Off', imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200&q=80', price: '1,890' },
        { id: 's2', title: 'Apex Runner Sport', subtitle: 'Save BDT 500', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80', price: '2,450' }
      ];

  // Sort sections by order
  const sortedSections = [...homepageSections].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="bg-white text-[#0F172A] flex flex-col font-sans select-none min-h-[600px] w-full text-left">
      
      {/* 1. Navbar */}
      <div className="bg-[#0F172A] text-white px-3 py-2 flex items-center justify-between text-[10px] shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center font-black text-white text-[9px] tracking-tighter">
            C
          </div>
          <span className="font-extrabold tracking-tight text-white text-[9px]">Choosify</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-bold text-gray-300">
          <span className="text-orange-500">Home</span>
          <span>Brands</span>
          <span>Deals</span>
          <span>Creators</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px]">🛒</span>
          <span className="w-3.5 h-3.5 rounded-full bg-orange-500 flex items-center justify-center text-[7px] font-bold text-white">👤</span>
        </div>
      </div>

      {/* 2. Announcement bar */}
      {globalSettings?.announcementBarEnabled && globalSettings?.announcementBarText && (
        <div className="bg-amber-500 text-[#0F172A] text-[8px] font-bold text-center py-1 truncate px-2 transition-all">
          📣 {globalSettings.announcementBarText}
        </div>
      )}

      {/* Dynamic Homepage Sections */}
      {sortedSections.map((sec) => {
        if (!sec.isVisible) return null;

        switch (sec.id) {
          case 'hero': {
            const activeBanner = heroBanners.find(b => b.isActive) || heroBanners[0] || {
              headline: "Bangladesh's Most Trusted Product Discovery Platform",
              subtitle: "Find verified brands, expert guides, and exclusive deals — all in one place.",
              ctaText: "Explore Products"
            };
            const highlighted = isSectionHighlighted('hero');
            return (
              <div 
                key={sec.id}
                className={`relative group p-4 text-center bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white border-y border-transparent transition-all ${
                  highlighted ? 'ring-4 ring-orange-500 ring-offset-2 animate-pulse' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="absolute top-1 right-1 bg-black/80 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>
                <h2 className="text-[11px] font-black tracking-tight text-white mb-1 leading-tight max-w-xs mx-auto">
                  {activeBanner.headline}
                </h2>
                <p className="text-[7.5px] text-orange-50 mb-2 max-w-xs mx-auto leading-normal">
                  {activeBanner.subtitle}
                </p>
                <button className="px-2.5 py-0.5 bg-white text-orange-600 hover:bg-orange-50 text-[7.5px] font-extrabold uppercase tracking-wider rounded transition-all shadow-sm cursor-pointer">
                  {activeBanner.ctaText || 'Shop Now'}
                </button>
              </div>
            );
          }

          case 'categories': {
            const highlighted = isSectionHighlighted('categories');
            return (
              <div 
                key={sec.id}
                className={`p-3 bg-white border-b border-gray-100 group relative transition-all ${
                  highlighted ? 'ring-4 ring-orange-500 ring-offset-2 animate-pulse' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>

                {/* Search Experience embedded */}
                <div className="mb-3 max-w-xs mx-auto">
                  <div className="relative flex items-center">
                    <Search className="w-2.5 h-2.5 text-gray-400 absolute left-2" />
                    <div className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded text-[7.5px] text-gray-400 font-medium select-none text-left">
                      Search verified brands, products or creators...
                    </div>
                  </div>
                  {popularSearches && popularSearches.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="text-[6px] text-gray-400 font-bold uppercase tracking-wider">Trending:</span>
                      {popularSearches.slice(0, 4).map((ps, idx) => (
                        <span key={ps.id || idx} className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[6px] font-medium text-gray-600">
                          {ps.query}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Categories Grid */}
                <div className="grid grid-cols-6 gap-1.5 text-center mt-2">
                  {[
                    { name: 'Apparel', icon: '👔' },
                    { name: 'Electronics', icon: '💻' },
                    { name: 'Grocery', icon: '🌾' },
                    { name: 'Lifestyle', icon: '👜' },
                    { name: 'Health', icon: '💊' },
                    { name: 'Services', icon: '🛠️' }
                  ].map((cat, idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[10px]">
                        {cat.icon}
                      </div>
                      <span className="text-[6.5px] text-gray-500 font-semibold mt-0.5 block truncate w-full">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          case 'trending': {
            const spotlightHighlighted = isSectionHighlighted('spotlight');
            const sponsoredHighlighted = isSectionHighlighted('sponsored');
            const trendingHighlighted = isSectionHighlighted('trending');

            return (
              <div key={sec.id} className="bg-white border-b border-gray-100">
                
                {/* 1. SPOTLIGHT BRANDS */}
                <div className={`p-3 border-b border-gray-50 group relative transition-all ${
                  spotlightHighlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/20'
                }`}>
                  <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                    Spotlight Brands
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[8px] font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Spotlight Brands
                    </h3>
                    <span className="text-[6.5px] text-orange-500 font-bold">Featured →</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                    {activeSpotlights.map((brand, idx) => {
                      const profile = brandProfiles?.find((p: any) => String(p.id) === String(brand.id));
                      const logo = profile?.logo || brand.imageUrl || brand.image || '';
                      return (
                        <div key={brand.id || idx} className="w-16 h-10 bg-gray-50 border border-gray-100 rounded flex flex-col items-center justify-center p-1 shrink-0 shadow-sm">
                          {logo ? (
                            <img src={logo} referrerPolicy="no-referrer" alt={brand.name || brand.title} className="max-h-6 max-w-[50px] object-contain rounded" />
                          ) : (
                            <span className="text-[7px] font-black text-gray-700 truncate w-full text-center">{brand.name || brand.title}</span>
                          )}
                          <span className="text-[5px] text-gray-400 font-medium truncate w-full text-center mt-0.5">{brand.category || 'Verified'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SPONSORED PRODUCTS */}
                <div className={`p-3 border-b border-gray-50 group relative transition-all ${
                  sponsoredHighlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/20'
                }`}>
                  <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                    Sponsored Products
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <h3 className="text-[8px] font-extrabold text-[#0F172A] uppercase tracking-wider">Sponsored Offers</h3>
                    <span className="bg-amber-500 text-[#0F172A] text-[5.5px] font-black px-1 py-0.5 rounded uppercase scale-90">Sponsored</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                    {displaySponsoredProducts.map((item, idx) => (
                      <div key={item.id || idx} className="w-20 bg-white border border-gray-100 rounded-lg p-1.5 shrink-0 flex flex-col justify-between hover:border-orange-500 transition-all shadow-sm">
                        <img src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80'} referrerPolicy="no-referrer" alt={item.title || item.name} className="w-full aspect-square object-cover rounded" />
                        <span className="text-[6.5px] font-bold text-gray-800 block truncate mt-1 leading-tight">{item.title || item.name}</span>
                        <span className="text-[6.5px] text-orange-500 font-extrabold mt-0.5 block">৳{item.price || '1,490'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. TRENDING PRODUCTS */}
                <div className={`p-3 group relative transition-all ${
                  trendingHighlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/20'
                }`}>
                  <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                    Trending Products
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[8px] font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5 text-orange-500 animate-bounce" /> Trending Products
                    </h3>
                    <span className="text-[6.5px] text-orange-500 font-bold cursor-pointer">View All →</span>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
                    {featuredProducts.length > 0 ? (
                      featuredProducts.slice(0, 4).map((item, idx) => {
                        const storedProducts = JSON.parse(localStorage.getItem('choosify_products') || '[]');
                        const matched = storedProducts.find((p: any) => String(p.id) === String(item.id));
                        const imgUrl = matched?.image || item.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80';
                        const price = matched?.price || '2,490';
                        return (
                          <div key={item.id || idx} className="w-16 bg-white border border-gray-100 rounded p-1 hover:border-orange-500 transition-colors shrink-0 flex flex-col justify-between shadow-sm">
                            <img src={imgUrl} referrerPolicy="no-referrer" alt={item.name} className="w-full aspect-square object-cover rounded" />
                            <span className="text-[6.5px] font-bold text-gray-800 block truncate mt-1 leading-none">{item.name}</span>
                            <span className="text-[6.5px] text-orange-500 font-extrabold mt-0.5 block">৳{price}</span>
                          </div>
                        );
                      })
                    ) : (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="w-16 bg-white border border-gray-100 rounded p-1 animate-pulse shrink-0">
                          <div className="w-full aspect-square bg-gray-100 rounded" />
                          <div className="h-1 bg-gray-100 rounded mt-1 w-3/4" />
                          <div className="h-1 bg-gray-100 rounded mt-0.5 w-1/2" />
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            );
          }

          case 'deals': {
            const activeDeals = featuredDeals.filter(d => !d.status || d.status === 'active' || d.status === 'ACTIVE' || d.status === 'scheduled');
            const highlighted = isSectionHighlighted('deals');
            return (
              <div 
                key={sec.id}
                className={`p-3 bg-[#0F172A] text-white border-b border-gray-50 group relative transition-all ${
                  highlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[8px] font-black uppercase tracking-wider text-white flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-amber-400" /> Flash Deals
                    </h3>
                    <span className="bg-amber-500 text-slate-900 text-[6px] font-black px-1 rounded animate-pulse">
                      02d : 14h
                    </span>
                  </div>
                  <span className="text-[6.5px] text-orange-400 font-bold cursor-pointer">View All →</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                  {activeDeals.length > 0 ? (
                    activeDeals.slice(0, 3).map((deal, idx) => (
                      <div key={deal.id || idx} className="w-20 bg-slate-900 border border-slate-800 rounded p-1 shrink-0">
                        <img src={deal.bannerUrl || deal.imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&q=80'} referrerPolicy="no-referrer" alt={deal.name || deal.title} className="w-full aspect-[16/10] object-cover rounded" />
                        <span className="text-[6.5px] font-black text-white truncate mt-1 w-full block leading-none">{deal.name || deal.title}</span>
                        <span className="text-[5.5px] text-gray-400 truncate mt-0.5 w-full block">{deal.ctaText || 'Grab Offer'}</span>
                      </div>
                    ))
                  ) : (
                    Array.from({ length: 2 }).map((_, idx) => (
                      <div key={idx} className="w-20 bg-slate-900 border border-slate-800 rounded p-1 animate-pulse shrink-0">
                        <div className="w-full aspect-[16/10] bg-slate-800 rounded" />
                        <div className="h-1 bg-slate-800 rounded mt-1 w-3/4" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          }

          case 'featured-brands': {
            const highlighted = isSectionHighlighted('featured-brands');
            return (
              <div 
                key={sec.id}
                className={`p-3 bg-white border-b border-gray-100 group relative transition-all ${
                  highlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-[8px] font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-2.5 h-2.5 text-gray-500" /> Featured Brands
                  </h3>
                  <span className="text-[6.5px] text-orange-500 font-bold cursor-pointer">View All →</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
                  {featuredBrands.length > 0 ? (
                    featuredBrands.slice(0, 4).map((brand, idx) => {
                      const profile = brandProfiles?.find((p: any) => String(p.id) === String(brand.id));
                      const logo = profile?.logo || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&q=80';
                      return (
                        <div key={brand.id || idx} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-full flex items-center gap-1 shrink-0 hover:border-orange-500 transition-colors cursor-pointer shadow-sm">
                          <img src={logo} referrerPolicy="no-referrer" alt={brand.name} className="w-3.5 h-3.5 rounded-full bg-white object-cover border border-gray-200" />
                          <span className="text-[6.5px] font-black text-gray-700">{brand.name}</span>
                        </div>
                      );
                    })
                  ) : (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-full w-12 h-4 animate-pulse shrink-0" />
                    ))
                  )}
                </div>
              </div>
            );
          }

          case 'creators': {
            const highlighted = isSectionHighlighted('creators');
            return (
              <div 
                key={sec.id}
                className={`p-3 bg-white border-b border-gray-100 group relative transition-all ${
                  highlighted ? 'ring-4 ring-orange-500 ring-offset-2 z-10 animate-pulse' : 'hover:border-orange-500/30'
                }`}
              >
                <div className="absolute top-1 right-1 bg-orange-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-[8px] font-extrabold text-[#0F172A] uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-orange-500" /> Featured Creators
                  </h3>
                  <span className="text-[6.5px] text-orange-500 font-bold cursor-pointer">View All →</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {featuredCreators.length > 0 ? (
                    featuredCreators.slice(0, 4).map((creator, idx) => {
                      const mockMatch = MOCK_CREATORS.find(mc => String(mc.id) === String(creator.id));
                      const handle = mockMatch?.handle || '@creator';
                      const trustScore = mockMatch?.trustScore || 90;
                      return (
                        <div key={creator.id || idx} className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded p-1 hover:border-orange-500 transition-colors cursor-pointer shadow-sm">
                          <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[7px] font-bold shrink-0">
                            👤
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[7px] font-black text-gray-800 block truncate leading-none">{creator.name}</span>
                            <span className="text-[5.5px] text-gray-400 block truncate mt-0.5">{handle}</span>
                          </div>
                          <span className="text-[6px] font-black text-orange-600 bg-orange-50 px-1 py-0.5 rounded shrink-0">
                            {trustScore}%
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    Array.from({ length: 2 }).map((_, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-100 rounded h-6 animate-pulse" />
                    ))
                  )}
                </div>
              </div>
            );
          }

          case 'newsletter': {
            return (
              <div 
                key={sec.id}
                className="p-4 text-center bg-gradient-to-r from-orange-500 to-amber-500 text-white select-none relative group"
              >
                <div className="absolute top-1 right-1 bg-orange-900 text-white text-[6px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none z-10">
                  {sec.label}
                </div>
                <h4 className="text-[8px] font-black uppercase tracking-widest text-white mb-0.5">Stay Ahead of the Market</h4>
                <p className="text-[6.5px] text-orange-50 mt-0.5 max-w-xs mx-auto leading-normal">
                  Subscribe for verified local guides, seller insights & flash campaign alerts.
                </p>
                <div className="mt-2 flex items-center max-w-[150px] mx-auto bg-white rounded overflow-hidden p-0.5">
                  <div className="flex-1 text-[6.5px] text-gray-400 text-left pl-1.5 font-medium">Enter email...</div>
                  <button className="bg-[#0F172A] text-white px-2 py-0.5 rounded text-[6.5px] font-black uppercase">
                    Join
                  </button>
                </div>
              </div>
            );
          }

          default:
            return null;
        }
      })}

      {/* 13. Footer */}
      <div className="bg-[#0F172A] text-gray-400 px-3 py-4 text-center select-none mt-auto">
        <div className="flex items-center justify-center gap-1 mb-1.5">
          <div className="w-3 h-3 rounded bg-orange-500 flex items-center justify-center font-black text-white text-[7px] tracking-tighter">
            C
          </div>
          <span className="font-extrabold text-[8px] tracking-tight text-white">Choosify Bangladesh</span>
        </div>
        <p className="text-[7px] text-gray-400 max-w-xs mx-auto leading-relaxed">
          {localFooter?.description || "Bangladesh's most trusted curated product discovery platform."}
        </p>
        <div className="border-t border-slate-800 mt-2.5 pt-2 text-[6px] text-slate-500 font-semibold uppercase">
          {localFooter?.copyrightText || "© 2025 Choosify Bangladesh. All rights reserved."}
        </div>
      </div>

    </div>
  );
}
