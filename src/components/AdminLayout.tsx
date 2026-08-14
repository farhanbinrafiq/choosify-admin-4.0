import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package, 
  Award, 
  Lightbulb, 
  Tag, 
  Star, 
  BarChart3, 
  ShieldCheck, 
  Settings,
  MessageCircleMore,
  Bolt,
  LogOut,
  ListOrdered,
  Wallet,
  Globe,
  FileText,
  History,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Megaphone,
  UserCheck,
  Lock,
  FolderLock,
  AlertTriangle,
  Search,
  Menu,
  FolderOpen,
  Truck,
  MapPin,
  Layers,
  ClipboardList,
  MessageSquarePlus,
  ShieldAlert,
  KeyRound,
  BadgeCheck,
  CreditCard,
  CircleDollarSign,
  Ticket,
  Send,
  Mail,
  Briefcase,
  TrendingUp,
  LayoutTemplate,
  Image as ImageIcon,
  Store,
  UserCircle,
  Handshake,
  Flag,
  X,
  Bell,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useRbac } from '../contexts/RbacContext';
import { useCMS } from '../contexts/CMSContext';
import { useOrders } from '../contexts/OrdersContext';
import { useContact } from '../contexts/ContactInteractionContext';
import { useBrandProfiles } from '../contexts/BrandProfilesContext';
import { ResizableSidebar } from './Layout/ResizableSidebar';
import { useLayoutPreferences } from '../hooks/useLayoutPreferences';
import { ChoosifyLogo } from './common/ChoosifyLogo';
import { UserProfileDropdown } from './account/UserProfileDropdown';
import { GlobalDashboardSearch } from './common/GlobalDashboardSearch';
import { useImpersonation } from '../contexts/ImpersonationContext';

interface SidebarItem {
  label: string;
  type?: 'label';
  icon?: any;
  path?: string;
  badge?: string | number;
  subItems?: { label: string; path: string; badge?: string | number }[];
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'Order' | 'Brand' | 'Seller' | 'Consumer';
  path: string;
}

const roleMenus: Record<UserRole, SidebarItem[]> = {
  super_admin: [
    // Exact navDefs from Choosify Admin CMS (standalone).html
    { label: 'Overview', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },

    { label: 'Account Management', type: 'label' },
    { label: 'Seller Management Studio', icon: Building2, path: '/admin/brand-studio' },
    { label: 'Creators Management', icon: Award, path: '/admin/creator-studio' },
    { label: 'Consumer Management', icon: Users, path: '/admin/consumers' },
    { label: 'Creator Economy', icon: TrendingUp, path: '/admin/creator-hub' },

    { label: 'Brand & Catalog', type: 'label' },
    { label: 'Products & Inventory', icon: Package, path: '/admin/products' },
    { label: 'Category Management Studio', icon: FolderOpen, path: '/admin/categories' },

    { label: 'Commerce', type: 'label' },
    { label: 'Orders Hub', icon: ListOrdered, path: '/admin/orders' },
    { label: 'Returns & Refunds', icon: RefreshCw, path: '/admin/returns' },

    { label: 'Marketing & Content', type: 'label' },
    { label: 'Ads & Deals Studio', icon: Megaphone, path: '/admin/ads-deals-studio', badge: 'NEW' },
    { label: 'Guide Management', icon: ClipboardList, path: '/admin/guides', badge: 'NEW' },

    { label: 'Logistics Management', type: 'label' },
    { label: 'Courier Providers', icon: Truck, path: '/admin/logistics/couriers' },
    { label: 'Shipment Operations', icon: Send, path: '/admin/logistics/shipments' },
    { label: 'Courier Analytics', icon: TrendingUp, path: '/admin/logistics/analytics' },

    { label: 'Trust & Safety', type: 'label' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Moderation Center', icon: ShieldCheck, path: '/admin/moderation' },
    { label: 'Disputes', icon: AlertTriangle, path: '/admin/disputes' },
    { label: 'Trust & Analytics', icon: ShieldAlert, path: '/admin/trust-center' },

    { label: 'Communication', type: 'label' },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages', badge: 12 },
    { label: 'Notifications', icon: Bell, path: '/admin/notifications' },

    { label: 'Finance', type: 'label' },
    { label: 'Finance', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Fee & Charges Engine', icon: Percent, path: '/admin/fee-charges', badge: 'NEW' },
    { label: 'Payouts', icon: CircleDollarSign, path: '/admin/payouts' },
    { label: 'Cashbook Hub', icon: Wallet, path: '/admin/cashbook', badge: 'PRIVATE' },

    { label: 'Super Admin Core', type: 'label' },
    { label: 'Admin Management', icon: UserCheck, path: '/admin/admins' },
    { label: 'Verification Center', icon: BadgeCheck, path: '/admin/brand-verification' },
    { label: 'Subscription Plans', icon: CreditCard, path: '/admin/promotions' },
    { label: 'Monetization Center', icon: CircleDollarSign, path: '/admin/monetization' },
    { label: 'Promo Codes & Vouchers', icon: Ticket, path: '/admin/coupons' },
    { label: 'Audit Logs', icon: History, path: '/admin/audit-logs' },

    { label: 'Website', type: 'label' },
    { label: 'Website Manager', icon: LayoutTemplate, path: '/admin/website-cms', badge: 'NEW' },

    { label: 'Settings', type: 'label' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  admin: [
    { label: 'Overview', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },

    { label: 'Account Management', type: 'label' },
    { label: 'Seller Management Studio', icon: Building2, path: '/admin/brand-studio' },
    { label: 'Creators Management', icon: Award, path: '/admin/creator-studio' },
    { label: 'Consumer Management', icon: Users, path: '/admin/consumers' },

    { label: 'Brand & Catalog', type: 'label' },
    { label: 'Products & Inventory', icon: Package, path: '/admin/products' },
    { label: 'Category Management Studio', icon: FolderOpen, path: '/admin/categories' },
    { label: 'Inventory & Stock', icon: Layers, path: '/admin/products?tab=alerts' },

    { label: 'Commerce', type: 'label' },
    { label: 'Orders Hub', icon: ListOrdered, path: '/admin/orders' },
    { label: 'Returns & Refunds', icon: RefreshCw, path: '/admin/returns' },
    { label: 'Lead Inbox', icon: Mail, path: '/admin/leads' },
    { label: 'Job Postings', icon: Briefcase, path: '/admin/jobs' },
    { label: 'Seller Offer Queue', icon: Send, path: '/admin/seller-offers' },

    { label: 'Marketing & Content', type: 'label' },
    { label: 'Ads & Deals Studio', icon: Megaphone, path: '/admin/ads-deals-studio', badge: 'NEW' },
    { label: "What's On / Brand Posts", icon: Megaphone, path: '/admin/brand-posts' },

    { label: 'Logistics Management', type: 'label' },
    { label: 'Courier Providers', icon: Truck, path: '/admin/logistics/couriers' },
    { label: 'Shipment Operations', icon: Send, path: '/admin/logistics/shipments' },
    { label: 'Courier Analytics', icon: TrendingUp, path: '/admin/logistics/analytics' },
    { label: 'Tracking Center', icon: MapPin, path: '/admin/logistics/tracking' },
    { label: 'Shipping Labels', icon: FileText, path: '/admin/logistics/labels' },

    { label: 'Trust & Safety', type: 'label' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Disputes', icon: AlertTriangle, path: '/admin/disputes' },
    { label: 'Trust & Analytics', icon: ShieldAlert, path: '/admin/trust-center' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },

    { label: 'Communication', type: 'label' },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages' },

    { label: 'Finance', type: 'label' },
    { label: 'Cashbook Hub', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },

    { label: 'Website', type: 'label' },
    { label: 'Website Manager', icon: LayoutTemplate, path: '/admin/website-cms', badge: 'NEW' },
    { label: "Today's Deals Banners", icon: ImageIcon, path: '/admin/deals-banners' },

    { label: 'Settings', type: 'label' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  seller: [
    { label: 'Seller Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Brand Management Studio', icon: Building2, path: '/admin/brand-studio' },
    { label: 'Seller Profile', icon: Store, path: '/admin/brand-profile' },
    { label: 'Orders Hub', icon: ListOrdered, path: '/admin/orders', badge: 4 },
    { label: 'My Customers', icon: Users, path: '/admin/customers' },
    { label: 'Returns & Refunds', icon: RefreshCw, path: '/admin/returns' },
    { label: 'Promo Codes & Vouchers', icon: Ticket, path: '/admin/coupons' },
    { label: 'Inventory & Stock', icon: Layers, path: '/admin/products?tab=alerts' },
    { label: 'Products', icon: Package, path: '/admin/products' },
    { label: 'My Brand Studio', icon: Store, path: '/dashboard/content-studio/brands' },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages', badge: 2 },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    
    { label: 'Logistics', type: 'label' },
    { label: 'Shipment Console', icon: Send, path: '/admin/logistics/shipments' },
    { label: 'Tracking Center', icon: MapPin, path: '/admin/logistics/tracking' },
    { label: 'Shipping Labels', icon: FileText, path: '/admin/logistics/labels' },

    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  creator: [
    { label: 'Creator Hub', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Creator Studio', icon: Award, path: '/admin/creator-studio' },
    { label: 'Creator Profile', icon: UserCircle, path: '/admin/creator-profile' },
    { label: 'Guides Studio', icon: FileText, path: '/dashboard/content-studio/guides' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
    { label: 'Collaborations', icon: Handshake, path: '/admin/creator-hub', badge: 1 },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  consumer: [
    { label: 'My Shopping', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'My Profile', icon: UserCircle, path: '/admin/consumer-profile' },
    { label: 'My Orders', icon: ListOrdered, path: '/admin/orders' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  moderator: [
    { label: 'Moderation Workspace', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Moderation Center', icon: ShieldCheck, path: '/admin/moderation' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages' },
  ],
  finance_manager: [
    { label: 'Finance Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Payouts', icon: CircleDollarSign, path: '/admin/payouts' },
    { label: 'Fee & Charges Engine', icon: Percent, path: '/admin/fee-charges' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  ],
  support_agent: [
    { label: 'Support Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Messages', icon: MessageCircleMore, path: '/admin/messages' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
  ],
  marketing_manager: [
    { label: 'Marketing Workspace', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Ads & Deals Studio', icon: Megaphone, path: '/admin/ads-deals-studio' },
    { label: 'Promo Codes & Vouchers', icon: Ticket, path: '/admin/coupons' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
    { label: 'Website CMS Studio', type: 'label' },
    {
      label: 'Website CMS Studio',
      icon: LayoutTemplate,
      path: '/admin/website-cms',
      badge: 'NEW'
    },
    {
      label: "Today's Deals Banners",
      icon: ImageIcon,
      path: '/admin/deals-banners',
    },
  ]
};

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, switchRole, activeBrandId, setActiveBrandId, sellerBrands, allBrands, requestNewBrand } = useAuth();
  const { canAccessPath } = useRbac();
  const { state: impersonation, exitImpersonation } = useImpersonation();
  const { cmsData } = useCMS();
  const location = useLocation();
  const navigate = useNavigate();
  const { getSizes, setSizes, setCollapsed } = useLayoutPreferences('sidebar');
  const savedSizes = getSizes();
  const currentWidthVal = savedSizes.length > 0 ? savedSizes[0] : 280;
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [isBrandsExpanded, setIsBrandsExpanded] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarNavQuery, setSidebarNavQuery] = useState('');
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Global search is now handled by <GlobalDashboardSearch /> (role-aware server-side).

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentRole = profile?.role || 'super_admin';
  
  const { messageThreads } = useOrders();
  const { unreadProfileCount, triggerOpenInbox } = useContact();

  const [supportMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('choosify_general_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const unreadSupportCount = supportMessages.filter((m: any) => m.status === 'UNREAD').length;
  const unreadOrdersCount = messageThreads.filter(m => m.status === 'UNREAD').length;
  const unreadTotal = unreadSupportCount + unreadProfileCount + unreadOrdersCount;

  const sidebarItems = (roleMenus[currentRole as UserRole] || [])
    .filter((item) => {
      if (item.type === 'label' || !item.path) return true;
      return canAccessPath(item.path);
    })
    .map(item => {
    if (item.label === 'Messages') {
      return {
        ...item,
        badge: unreadTotal > 0 ? unreadTotal : undefined
      };
    }
    return item;
  });

  const filteredSidebarItems = React.useMemo(() => {
    const query = sidebarNavQuery.trim().toLowerCase();
    if (!query) return sidebarItems;

    const matched: SidebarItem[] = [];
    let pendingLabel: SidebarItem | null = null;

    for (const item of sidebarItems) {
      if (item.type === 'label') {
        pendingLabel = item;
        continue;
      }

      const haystack = item.label.toLowerCase();
      if (haystack.includes(query) || query.split(/\s+/).every((term) => haystack.includes(term))) {
        if (pendingLabel && !matched.some((entry) => entry.type === 'label' && entry.label === pendingLabel!.label)) {
          matched.push(pendingLabel);
        }
        matched.push(item);
        pendingLabel = null;
      }
    }

    return matched.length > 0
      ? matched
      : [{ label: 'No navigation matches', type: 'label' }];
  }, [sidebarItems, sidebarNavQuery]);

  const sidebarItemsToRender = sidebarNavQuery.trim() ? filteredSidebarItems : sidebarItems;

  const PAGE_SUBTITLES: Record<string, string> = {
    '/admin/dashboard': 'Overview of store performance',
    '/admin/consumers': 'Manage registered platform buyers',
    '/admin/creators-hub': 'Monitor content curators and campaigns',
    '/admin/creator-studio': 'Edit creator profile cards & media',
    '/admin/sellers': 'Verified merchants & brand listings',
    '/admin/products': 'Manage live storefront SKUs',
    '/admin/categories': 'Navigation & discovery structure',
    '/admin/orders': 'Platform-wide order lifecycle',
    '/admin/returns': 'Return and refund workflows',
    '/admin/reviews': 'Customer review moderation',
    '/admin/moderation': 'Content & listing moderation queue',
    '/admin/disputes': 'Buyer-seller dispute resolution',
    '/admin/messages': 'Unified customer conversations',
    '/admin/settings': 'Platform configuration',
  };
  const activeSidebarItem = sidebarItems.find(
    (item) => item.path && item.path.split('?')[0] === location.pathname
  );
  const currentPageTitle = activeSidebarItem?.label || 'Dashboard';
  const currentPageSubtitle = PAGE_SUBTITLES[location.pathname] || 'Manage and monitor this section';
  const sellerRelations = sellerBrands.filter(r => r.seller_user_id === profile?.id);
  const sellerBrandsList = allBrands.filter(b => sellerRelations.some(r => r.brand_id === b.id));

  const handleSwitchRole = (role: UserRole) => {
    switchRole(role);
    setShowRoleSwitcher(false);
    navigate('/admin/dashboard');
  };

  useEffect(() => {
    if (!profile) return;
    
    const path = location.pathname;
    
    // Check permission rules for Seller
    if (profile.role === 'seller') {
      const allowedSellers = [
        '/admin/dashboard',
        '/admin/orders',
        '/admin/products',
        '/products',
        '/seller/products',
        '/seller/', // UniversalProfileShell self / inspect routes (/seller/:id)
        '/upe/seller/',
        '/dashboard/content-studio/products',
        '/dashboard/content-studio/brands',
        '/admin/brand-profiles',
        '/admin/brand-profile',
        '/admin/brand-studio',
        '/admin/sellers',
        '/admin/ownership-claims',
        '/admin/messages',
        '/admin/reviews',
        '/admin/analytics',
        '/admin/settings',
        '/admin/customers',
        '/admin/returns',
        '/admin/coupons',
        '/admin/invoice',
        '/admin/cashbook',
        '/admin/logistics/couriers',
        '/admin/logistics/shipments',
        '/admin/logistics/analytics',
        '/admin/logistics/tracking',
        '/admin/logistics/labels'
      ];
      
      const isAllowed =
        allowedSellers.some((p) =>
          p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`),
        ) ||
        (path.startsWith('/admin/sellers/') && path !== '/admin/sellers');
      if (!isAllowed) {
        navigate('/admin/dashboard', { replace: true });
      }
    } 
    // Check permission rules for Creator
    else if (profile.role === 'creator') {
      const allowedCreators = [
        '/admin/dashboard',
        '/admin/creators/1',
        '/admin/creator-studio',
        '/admin/creator-profile',
        '/admin/creators-hub',
        '/creator/', // UniversalProfileShell self / inspect routes (/creator/:id)
        '/upe/creator/',
        '/admin/products',
        '/products',
        '/seller/products',
        '/dashboard/content-studio/products',
        '/dashboard/content-studio/guides',
        '/admin/recommendations',
        '/admin/creator-hub',
        '/admin/messages',
        '/admin/reviews',
        '/admin/analytics',
        '/admin/settings',
        '/admin/cashbook'
      ];
      const isAllowed = allowedCreators.some((p) =>
        p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`),
      );
      if (!isAllowed) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [profile, location.pathname, navigate]);

  const renderSidebarContent = (isCollapsed = false, toggleCollapse = () => {}) => (
    <>
      <div className={`py-6 px-4 flex ${isCollapsed ? 'flex-col items-center justify-center' : 'items-center justify-between'} gap-3 border-b border-white/[0.03]`}>
        <div className="flex items-center gap-3 overflow-hidden shrink-0">
          <ChoosifyLogo variant={isCollapsed ? "icon" : "full"} theme="dark" className={isCollapsed ? "h-8 w-8 select-none" : "h-11 w-auto max-w-[220px] select-none"} />
        </div>

        <button
          onClick={toggleCollapse}
          className={`sidebar-collapse-btn w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${isCollapsed ? 'mt-2' : ''}`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <Menu className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-6 custom-scrollbar">
        {!isCollapsed && (
          <div className="mb-3 px-1">
            <div className="relative sidebar-nav-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50 pointer-events-none" />
              <input
                type="search"
                value={sidebarNavQuery}
                onChange={(e) => setSidebarNavQuery(e.target.value)}
                placeholder="Search menu & categories..."
                aria-label="Search navigation menu"
                className="w-full rounded-xl border py-2 pl-9 pr-8 text-[11px] font-medium outline-none transition-all"
              />
              {sidebarNavQuery && (
                <button
                  type="button"
                  onClick={() => setSidebarNavQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Clear navigation search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {sidebarItemsToRender.map((item, idx) => {
          if (item.type === 'label') {
            if (isCollapsed) return <div key={idx} className="h-px bg-white/[0.05] my-4 mx-2" />;
            const isEmptyState = item.label === 'No navigation matches';
            return (
              <div
                key={idx}
                className={`text-[10px] font-bold px-3 pt-6 pb-2 uppercase tracking-[0.8px] truncate whitespace-nowrap ${
                  isEmptyState ? 'text-white/40 normal-case tracking-normal font-medium' : 'text-white/35'
                }`}
              >
                {item.label}
              </div>
            );
          }
          const Icon = item.icon!;
          const hasSub = item.subItems && item.subItems.length > 0;
          
          const [itemPath, itemQuery] = item.path ? item.path.split('?') : ['', ''];
          
          const isParentActive = item.path
            ? (itemPath === '/admin/dashboard'
                ? location.pathname === '/admin/dashboard'
                : item.subItems
                  ? (location.pathname === itemPath || (itemPath.length > 7 && location.pathname.startsWith(itemPath + '/')))
                  : location.pathname === itemPath)
            : false;
          
          const isChildActive = item.subItems?.some(sub => {
            const [subPath, subQuery] = sub.path.split('?');
            const pathMatches = location.pathname === subPath;
            if (subQuery) {
              const searchParam = subQuery.split('=')[1];
              const cleanSearch = location.search.replace('?', '');
              if (searchParam === 'overview' && cleanSearch === '') {
                return pathMatches;
              }
              return pathMatches && cleanSearch.includes(searchParam);
            }
            return pathMatches;
          }) || false;

          const totalItemBadge = item.badge || item.subItems?.reduce((acc, sub) => {
            const b = sub.badge;
            if (typeof b === 'number') return acc + b;
            if (typeof b === 'string') {
              const num = parseInt(b, 10);
              return acc + (isNaN(num) ? 0 : num);
            }
            return acc;
          }, 0) || 0;

          const isActive = isParentActive || isChildActive;
          const isCurrentlyExpanded = expandedMenus[item.label] !== undefined 
            ? expandedMenus[item.label] 
            : (isChildActive || isParentActive);

          return (
            <div key={idx} className="mb-1">
              {hasSub ? (
                <button
                  onClick={() => !isCollapsed && toggleMenu(item.label)}
                  className={`w-full group flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 text-[13px] font-bold rounded-lg transition-all duration-300 text-left cursor-pointer min-w-0 sidebar-nav-hover ${
                    isActive
                      ? 'bg-[#EF3C23]/[0.16] text-[#EF3C23]'
                      : 'text-white/90'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${isActive ? 'text-[#EF3C23]' : 'text-white/70'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="transition-colors duration-300 flex-1 font-semibold flex items-center gap-2 min-w-0">
                        <span className="truncate whitespace-nowrap flex-1 min-w-0">{item.label}</span>
                        {totalItemBadge > 0 && (
                          <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-black shrink-0 ${
                            isActive
                              ? 'bg-[#EF3C23] text-white'
                              : 'bg-white/10 text-white'
                          }`}>
                            {totalItemBadge}
                          </span>
                        )}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform shrink-0 ${isActive ? 'text-[#EF3C23]' : 'text-white/60'} ${isCurrentlyExpanded ? 'rotate-90' : ''}`} />
                    </>
                  )}
                  {isCollapsed && totalItemBadge > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF3C23] rounded-full" />
                  )}
                </button>
              ) : (
                <NavLink
                  to={item.path!}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 text-[13px] font-bold rounded-lg transition-all duration-300 relative min-w-0 sidebar-nav-hover ${
                    isActive
                      ? 'bg-[#EF3C23]/[0.16] text-[#EF3C23]'
                      : 'text-white/90'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${isActive ? 'text-[#EF3C23]' : 'text-white/70'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="transition-colors duration-300 font-semibold truncate whitespace-nowrap flex-1 min-w-0">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          isActive ? 'bg-[#EF3C23] text-white' : 'bg-white/10 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF3C23] rounded-full animate-pulse" />
                  )}
                </NavLink>
              )}

              {!isCollapsed && hasSub && isCurrentlyExpanded && item.subItems && (
                <div className="mt-1 pl-6 space-y-1 bg-white/[0.01] border-l border-white/[0.04] ml-5 rounded-bl-sm">
                  {item.subItems.map((sub, sIdx) => {
                    const [subPath, subQuery] = sub.path.split('?');
                    const subParam = subQuery ? subQuery.split('=')[1] : null;
                    const isSubActive = location.pathname === subPath && 
                      (!subQuery || location.search.includes(subParam!) || (subParam === 'overview' && !location.search));
                    
                    return (
                      <NavLink
                        key={sIdx}
                        to={sub.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-2 py-2 px-3 text-[11px] font-medium rounded-lg transition-all sidebar-nav-hover ${
                          isSubActive
                            ? 'text-[#EF3C23] font-bold bg-[#EF3C23]/[0.16]'
                            : 'text-white/80'
                        }`}
                      >
                        <ChevronRight className={`w-2.5 h-2.5 ${isSubActive ? 'text-[#EF3C23] rotate-90 scale-110' : 'text-white/60 rotate-90'}`} />
                        <span className="truncate whitespace-nowrap flex-1 min-w-0">{sub.label}</span>
                        {sub.badge && (
                          <span className={`ml-auto text-[8px] px-1 py-0.2 rounded font-black ${isSubActive ? 'bg-[#EF3C23] text-white' : 'bg-white/10 text-white'}`}>
                            {sub.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={`p-4 border-t border-white/10 flex ${isCollapsed ? 'flex-col gap-4 items-center justify-center' : 'items-center gap-3'} mt-auto`}>
        <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {profile?.displayName?.[0] || 'U'}
        </div>
        {!isCollapsed ? (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-semibold truncate">{profile?.displayName || 'User'}</p>
              <p className="text-white/70 text-[9px] truncate">{profile?.email || 'user@example.com'}</p>
            </div>
            <button onClick={handleLogout} className="text-white hover:text-[#CBD5E1] transition-colors cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button onClick={handleLogout} className="text-white hover:text-[#CBD5E1] transition-colors cursor-pointer" title="Logout">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-text-primary font-sans relative">
      {/* Floating Restore Button if size becomes 0 or invalid */}
      {(currentWidthVal <= 0 || isNaN(currentWidthVal)) && (
        <button
          onClick={() => {
            setSizes([280]);
            setCollapsed(false);
            window.location.reload();
          }}
          className="fixed top-4 left-4 z-[999] px-4 py-2 bg-orange-500 hover:bg-orange-650 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-2xl flex items-center gap-1.5 border border-orange-600 transition-all cursor-pointer"
        >
          <Menu className="w-4 h-4" /> Show Navigation
        </button>
      )}
      {/* Role Switcher Debug Panel */}
      {((import.meta as any).env?.DEV) && (
        <div className="fixed bottom-6 right-6 z-[60]">
           <button 
             onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
             className="w-12 h-12 bg-app-accent text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group"
             title="Switch Role (Debug)"
           >
              <RefreshCw className={`w-5 h-5 ${showRoleSwitcher ? 'rotate-180' : ''} transition-transform duration-500`} />
           </button>
           
           <AnimatePresence>
             {showRoleSwitcher && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.8, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.8, y: 20 }}
                 className="absolute bottom-16 right-0 w-64 bg-app-card border border-app-border rounded-2xl p-4 shadow-2xl"
               >
                  <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest mb-3 px-2">Switch Account Role</div>
                  <div className="space-y-1">
                     {[
                       'super_admin', 
                       'admin',
                       'moderator',
                       'finance_manager',
                       'support_agent',
                       'marketing_manager',
                       'seller', 
                       'creator', 
                     ].map((role) => (
                       <button
                         key={role}
                         onClick={() => handleSwitchRole(role as UserRole)}
                         className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all ${
                           currentRole === role 
                             ? 'bg-app-accent text-white' 
                             : 'text-app-text-secondary hover:bg-white/5 hover:text-white'
                         }`}
                       >
                         <span className="capitalize">{role.replace('_', ' ')}</span>
                         {currentRole === role && <ChevronRight className="w-3 h-3" />}
                       </button>
                     ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-app-border text-[9px] text-app-text-secondary italic px-2">
                     Role switching updates navigation & dashboard instantly for testing.
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      )}

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[299] sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {/* Mobile Sidebar */}
      <aside
        ref={sidebarRef}
        className={`sidebar w-[240px] h-full bg-app-sidebar flex flex-col shrink-0 border-r border-app-border overflow-hidden
          fixed sm:hidden z-[300] top-0 left-0 transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {renderSidebarContent()}
      </aside>

      {/* Desktop Resizable Sidebar */}
      <ResizableSidebar
        defaultWidth={240}
        minWidth={72}
        maxWidth={450}
        className="hidden sm:flex h-full"
      >
        {(isCollapsed, toggleCollapse) => (
          <div className="sidebar flex flex-col h-full w-full bg-app-sidebar border-r border-app-border">
            {renderSidebarContent(isCollapsed, toggleCollapse)}
          </div>
        )}
      </ResizableSidebar>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        <header className="glass-header h-[64px] px-8 flex items-center gap-3 sm:gap-4 shrink-0 mb-2 sticky top-0 z-40">
          <button
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg glass-on-navy text-white hover:text-app-accent transition-colors flex-shrink-0"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex flex-col min-w-0 shrink max-w-[min(220px,20vw)]">
            <h1 className="text-[15px] font-extrabold text-white leading-tight truncate">{currentPageTitle}</h1>
            <p className="text-[11px] text-white/50 truncate">{currentPageSubtitle}</p>
          </div>

          {/* Flexible center search — Choosify-Web navbar-fluid: flex-1 + pad band */}
          <div className="relative flex-1 min-w-0 basis-0 px-1 sm:px-3 md:px-4 lg:px-5">
            <GlobalDashboardSearch variant="header" className="w-full" ready={Boolean(profile?.role)} />
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
             <button
               onClick={() => triggerOpenInbox()}
               className="w-8 h-8 rounded-full glass-on-navy flex items-center justify-center hover:bg-white/20 active:scale-95 cursor-pointer relative shrink-0 transition-all"
               title="Open Messenger"
             >
               <MessageCircleMore className="w-4 h-4 text-white" />
               {unreadTotal > 0 && (
                 <span id="NotificationBadge" className="absolute -top-1 -right-1 bg-[#EF3C23] text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-[#000435] NotificationBadge">
                   {unreadTotal}
                 </span>
               )}
             </button>

             <div className="w-8 h-8 rounded-full glass-on-navy flex items-center justify-center">
                <div className="relative">
                  <Bell className="w-4 h-4 text-white" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-app-accent rounded-full border-2 border-[#000435]" />
                </div>
             </div>

             <UserProfileDropdown variant="header" />
          </div>
        </header>

        {impersonation.active && (
          <div className="mb-4 px-6 py-3 rounded-[4px] border border-rose-300/40 bg-rose-600/10 text-rose-200 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-200">IMPERSONATION MODE</div>
              <div className="text-[12px] font-bold text-white/90 truncate mt-1">
                Viewing as: {profile?.displayName || 'User'} · {profile?.role || '—'} · {profile?.choosifyUserId || '—'}
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = window.confirm('Exit impersonation and return to the original admin session?');
                if (!ok) return;
                await exitImpersonation();
              }}
              className="shrink-0 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
            >
              Exit Impersonation
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar scroll-smooth">
          <motion.div
            key={location.pathname + currentRole}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
};
