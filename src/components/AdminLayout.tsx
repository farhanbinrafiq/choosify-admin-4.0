import React, { useState, useEffect } from 'react';
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
  Link as LinkIcon, 
  BarChart3, 
  Bell, 
  ShieldCheck, 
  Settings,
  MessageCircle,
  Bolt,
  LogOut,
  ShoppingBag,
  ListOrdered,
  Wallet,
  Globe,
  PlusCircle,
  FileText,
  Heart,
  History,
  Compass,
  Zap,
  ChevronRight,
  RefreshCw,
  Megaphone,
  UserCheck,
  Lock,
  FolderLock,
  Activity,
  AlertTriangle,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useCMS } from '../contexts/CMSContext';
import { useOrders } from '../contexts/OrdersContext';
import { useContact } from '../contexts/ContactInteractionContext';
import { useBrandProfiles } from '../contexts/BrandProfilesContext';

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
    { label: 'Admin Terminal', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Consumers', icon: Users, path: '/admin/consumers' },
    { label: 'Brand Management Studio', icon: Globe, path: '/admin/sellers' },
    { label: 'Products', icon: Package, path: '/admin/products' },
    { label: 'Order Console', icon: ListOrdered, path: '/admin/orders' },
    { label: 'Orders Overview', icon: BarChart3, path: '/admin/orders-overview' },
    { label: 'Creators', icon: Award, path: '/admin/creators?viewMode=creators' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Moderation Center', icon: ShieldCheck, path: '/admin/moderation' },
    { label: 'Community Submissions', icon: Users, path: '/admin/community-submissions' },
    { label: 'Disputes', icon: AlertTriangle, path: '/admin/moderation?tab=disputes' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages', badge: 12 },
    { label: 'Trust Center', icon: ShieldCheck, path: '/admin/trust-center' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
    
    { label: 'Super Admin Core', type: 'label' },
    { label: 'Admin Management', icon: UserCheck, path: '/admin/admins?viewMode=admins' },
    { label: 'Role Management', icon: Lock, path: '/admin/settings?tab=roles' },
    { label: 'Permissions', icon: ShieldCheck, path: '/admin/settings?tab=permissions' },
    { label: 'System Configuration', icon: Bolt, path: '/admin/cms' },
    { label: 'Verification Center', icon: Award, path: '/admin/brand-verification' },
    { label: 'Fraud Detection Engine', icon: Zap, path: '/admin/moderation-v2' },
    { label: 'Subscription Plans', icon: Tag, path: '/admin/promotions?tab=plans' },
    { label: 'Monetization Center', icon: Wallet, path: '/admin/payouts' },
    { label: 'Promo Codes', icon: Tag, path: '/admin/deals?tab=promocodes' },
    { label: 'Audit Logs', icon: History, path: '/admin/moderation?tab=reports' },
    { label: 'Security Center', icon: FolderLock, path: '/admin/settings?tab=security' },
    { label: 'Feature Flags', icon: Activity, path: '/admin/settings?tab=features' },
  ],
  admin: [
    { label: 'Admin Workspace', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Consumers', icon: Users, path: '/admin/consumers' },
    { label: 'Brand Management Studio', icon: Globe, path: '/admin/sellers' },
    { label: 'Products', icon: Package, path: '/admin/products' },
    { label: 'Order Console', icon: ListOrdered, path: '/admin/orders' },
    { label: 'Orders Overview', icon: BarChart3, path: '/admin/orders-overview' },
    { label: 'Creators', icon: Award, path: '/admin/creators?viewMode=creators' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Community Submissions', icon: Users, path: '/admin/community-submissions', badge: 'New' },
    { label: 'Disputes', icon: AlertTriangle, path: '/admin/moderation?tab=disputes' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages' },
    { label: 'Trust Center', icon: ShieldCheck, path: '/admin/trust-center' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  seller: [
    { label: 'Seller Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'My Profile', icon: UserCheck, path: '/admin/sellers/seller_001?tab=overview' },
    { label: 'Order Console', icon: ListOrdered, path: '/admin/orders', badge: 4 },
    { label: 'Products', icon: Package, path: '/admin/products' },
    { label: 'My Brand Studio', icon: Globe, path: '/dashboard/content-studio/brands' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages', badge: 2 },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  creator: [
    { label: 'Creator Hub', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Creator Profile', icon: Users, path: '/admin/creators/1' },
    { label: 'Guides Studio', icon: FileText, path: '/dashboard/content-studio/guides' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
    { label: 'Collaborations', icon: ShieldCheck, path: '/admin/creator-hub', badge: 1 },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Finance', type: 'label' },
    { label: 'My Cashbook', icon: Wallet, path: '/admin/cashbook', badge: 'Private' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  moderator: [
    { label: 'Moderation Workspace', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Moderation Center', icon: ShieldCheck, path: '/admin/moderation' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages' },
  ],
  finance_manager: [
    { label: 'Finance Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Payouts', icon: Wallet, path: '/admin/payouts' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  ],
  support_agent: [
    { label: 'Support Operations', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
  ],
  marketing_manager: [
    { label: 'Marketing Workspace', type: 'label' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Promotions', icon: Megaphone, path: '/admin/promotions' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
  ]
};

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, switchRole, activeBrandId, setActiveBrandId, sellerBrands, allBrands, requestNewBrand } = useAuth();
  const { cmsData } = useCMS();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [isBrandsExpanded, setIsBrandsExpanded] = useState(true);

  // Global Search State & Logic
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  const { orders, customers } = useOrders();
  let profiles: any[] = [];
  try {
    const brandCtx = useBrandProfiles();
    if (brandCtx && brandCtx.profiles) {
      profiles = brandCtx.profiles;
    }
  } catch (e) {
    // fallback context safety
  }

  const searchResults = React.useMemo(() => {
    if (searchQuery.trim().length < 3) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const results: SearchResultItem[] = [];

    // 1. Orders
    const matchedOrders = (orders || []).filter(o => 
      o.id.toLowerCase().includes(query) || 
      (o.invoice_id && o.invoice_id.toLowerCase().includes(query)) ||
      (o.product?.name && o.product.name.toLowerCase().includes(query))
    );
    matchedOrders.forEach(o => {
      results.push({
        id: o.id,
        title: `Order ${o.id}`,
        subtitle: `${o.product?.name || 'Items'} - BDT ${o.earnings?.totalRevenue || 0}`,
        type: 'Order',
        path: `/upe/order/${o.id}`
      });
    });

    // 2. Brands
    const staticBrands = [
      { id: 'b1', name: 'Samsung Mobile Bangladesh', category: 'Electronics' },
      { id: 'b2', name: 'Aarong Saree & crafts', category: 'Fashion' },
      { id: 'b3', name: 'Yellow clothing', category: 'Fashion' },
      { id: 'b4', name: 'Apex Footwear', category: 'Accessories' },
      { id: 'b5', name: 'Bata Bangladesh', category: 'Accessories' }
    ];
    const sourceBrands = profiles && profiles.length > 0 ? profiles : staticBrands;
    const matchedBrands = sourceBrands.filter((b: any) => 
      b.name.toLowerCase().includes(query) || 
      (b.category && b.category.toLowerCase().includes(query))
    );
    matchedBrands.forEach((b: any) => {
      results.push({
        id: b.id,
        title: b.name,
        subtitle: `Brand / ${b.category || 'Retail'}`,
        type: 'Brand',
        path: `/upe/brand/${b.id}`
      });
    });

    // 3. Sellers
    const derivedSellers = new Map<string, { id: string; name: string; info?: string }>();
    (orders || []).forEach(o => {
      if (o.product?.sellerId && o.product?.sellerName) {
        derivedSellers.set(o.product.sellerId, { id: o.product.sellerId, name: o.product.sellerName, info: o.product.brand });
      }
    });
    const staticSellers = [
      { id: 's1', name: 'Nadia Akter', info: 'Daraz Seller' },
      { id: 's2', name: 'Rifat Hasan', info: 'Verified Influencer' },
      { id: 's3', name: 'StyleCouture BD', info: 'Premium Boutique' }
    ];
    staticSellers.forEach(s => {
      derivedSellers.set(s.id, s);
    });
    const matchedSellers = Array.from(derivedSellers.values()).filter(s => 
      s.name.toLowerCase().includes(query)
    );
    matchedSellers.forEach(s => {
      results.push({
        id: s.id,
        title: s.name,
        subtitle: `Seller / ${s.info || 'Merchant'}`,
        type: 'Seller',
        path: `/upe/seller/${s.id}`
      });
    });

    // 4. Consumers
    const derivedConsumers = new Map<string, { id: string; name: string; email: string }>();
    (customers || []).forEach(c => {
      derivedConsumers.set(c.id, { id: c.id, name: c.name, email: c.email });
    });
    const staticConsumers = [
      { id: 'c1', name: 'Mehedi Rahman', email: 'mehedi@gmail.com' },
      { id: 'c2', name: 'Nusrat Jahan', email: 'nusrat@outlook.com' },
      { id: 'c3', name: 'Farhana Islam', email: 'farhana@yahoo.com' }
    ];
    staticConsumers.forEach(c => {
      derivedConsumers.set(c.id, c);
    });
    const matchedConsumers = Array.from(derivedConsumers.values()).filter(c => 
      c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)
    );
    matchedConsumers.forEach(c => {
      results.push({
        id: c.id,
        title: c.name,
        subtitle: c.email,
        type: 'Consumer',
        path: `/upe/consumer/${c.id}`
      });
    });

    return results;
  }, [searchQuery, orders, customers, profiles]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSearchFocused(false);
        if (searchContainerRef.current) {
          (searchContainerRef.current.querySelector('input') as HTMLInputElement)?.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

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

  const sidebarItems = (roleMenus[currentRole as UserRole] || []).map(item => {
    if (item.label === 'Messages') {
      return {
        ...item,
        badge: unreadTotal > 0 ? unreadTotal : undefined
      };
    }
    return item;
  });

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
        '/dashboard/content-studio/brands',
        '/admin/brand-profiles',
        '/admin/ownership-claims',
        '/admin/messages',
        '/admin/reviews',
        '/admin/analytics',
        '/admin/settings',
        '/admin/customers',
        '/admin/invoice',
        '/admin/cashbook'
      ];
      
      const isAllowed = allowedSellers.some(p => path === p || path.startsWith(p + '/')) || (path.startsWith('/admin/sellers/') && path !== '/admin/sellers');
      if (!isAllowed) {
        navigate('/admin/dashboard', { replace: true });
      }
    } 
    // Check permission rules for Creator
    else if (profile.role === 'creator') {
      const allowedCreators = [
        '/admin/dashboard',
        '/admin/creators/1',
        '/creator/1',
        '/dashboard/content-studio/guides',
        '/admin/recommendations',
        '/admin/creator-hub',
        '/admin/messages',
        '/admin/analytics',
        '/admin/settings',
        '/admin/cashbook'
      ];
      const isAllowed = allowedCreators.some(p => path === p || path.startsWith(p + '/'));
      if (!isAllowed) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [profile, location.pathname, navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-text-primary font-sans relative">
      {/* Role Switcher Debug Panel */}
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

      {/* Sidebar */}
      <aside className="sidebar w-[240px] h-full bg-app-sidebar flex flex-col shrink-0 border-r border-app-border overflow-hidden">
        <div className="py-8 px-6 flex items-center gap-3">
          {cmsData.logos.header ? (
            <img src={cmsData.logos.header} alt="Choosify Logo" className="h-8 object-contain" />
          ) : (
            <>
              <div className="w-8 h-8 bg-gradient-to-br from-app-accent to-app-bg rounded-lg flex items-center justify-center border border-app-accent/30 shadow-lg shadow-app-accent/20">
                <Bolt className="text-white w-5 h-5 fill-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tighter text-white">
                  Choosify<span className="text-app-accent">.bd</span>
                </h1>
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-6 custom-scrollbar">
          {sidebarItems.map((item, idx) => {
            if (item.type === 'label') {
              return (
                <div key={idx} className="text-[10px] font-bold text-[#CBD5E1] px-3 pt-6 pb-2 uppercase tracking-widest">
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
                  : location.pathname === itemPath || location.pathname.startsWith(itemPath + '/')) 
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
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full group flex items-center gap-3 px-3.5 py-3 text-[13px] font-medium rounded-r-lg border-l-4 transition-all duration-300 text-left cursor-pointer ${
                      isActive 
                        ? 'bg-[#F97316] text-white border-white' 
                        : 'border-transparent text-white hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-all duration-300 text-white" />
                    <span className="transition-colors duration-300 flex-1 text-white font-semibold flex items-center gap-2">
                      {item.label}
                      {totalItemBadge > 0 && (
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-black ${
                          isActive 
                            ? 'bg-white text-[#F97316]' 
                            : 'bg-[#F97316] text-white'
                        }`}>
                          {totalItemBadge}
                        </span>
                      )}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-white transition-transform ${isCurrentlyExpanded ? 'rotate-90' : ''}`} />
                  </button>
                ) : (
                  <NavLink
                    to={item.path!}
                    className={`group flex items-center gap-3 px-3.5 py-3 text-[13px] font-medium rounded-r-lg border-l-4 transition-all duration-300 ${
                      isActive 
                        ? 'active-sidebar-item bg-[#F97316] text-white border-white shadow-[0_4px_16px_rgba(249,115,22,0.15)]' 
                        : 'border-transparent text-white hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-all duration-300 text-white" />
                    <span className="transition-colors duration-300 text-white font-semibold">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="ml-auto bg-white text-[#F97316] text-[9px] px-1.5 py-0.5 rounded font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )}

                {hasSub && isCurrentlyExpanded && item.subItems && (
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
                          className={`flex items-center gap-2 py-2 px-3 text-[11px] font-medium rounded-md transition-all ${
                            isSubActive 
                              ? 'text-white font-bold bg-[#F97316]' 
                              : 'text-[#E2E8F0] hover:text-white hover:bg-white/[0.02]'
                          }`}
                        >
                          <ChevronRight className={`w-2.5 h-2.5 ${isSubActive ? 'text-white rotate-90 scale-110' : 'text-[#E2E8F0] opacity-60'}`} />
                          <span className="truncate">{sub.label}</span>
                          {sub.badge && (
                            <span className="ml-auto bg-[#F97316] text-white text-[8px] px-1 py-0.2 rounded font-black">
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

        <div className="p-4 border-t border-app-border flex items-center gap-3 mt-auto">
          <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white text-[10px] font-bold">
            {profile?.displayName?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-semibold truncate">{profile?.displayName || 'User'}</p>
            <p className="text-[#CBD5E1] text-[9px] truncate">{profile?.email || 'user@example.com'}</p>
          </div>
          <button onClick={handleLogout} className="text-white hover:text-[#CBD5E1] transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        <header className="h-[64px] px-8 flex items-center justify-between shrink-0 mb-2 border-b border-app-border bg-app-card sticky top-0 z-40">
          <div className="flex flex-col">
            <div className="text-[12px] text-app-text-secondary opacity-60">
              {currentRole.replace('_', ' ').toUpperCase()} / Dashboard / {location.pathname.split('/').pop()?.replace('-', ' ')}
            </div>
          </div>

          {/* MIDDLE GLOBAL SEARCH ENGINE */}
          <div className="relative mx-4 flex-1 max-w-sm" ref={searchContainerRef}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search catalog, brands, sellers..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                className="pl-9 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] w-full max-w-xs placeholder-gray-400 outline-none focus:border-orange-400 text-slate-800 transition-colors"
              />
            </div>

            {/* SEARCH DROPDOWN */}
            {isSearchFocused && searchQuery.trim().length >= 3 && (
              <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-80 overflow-y-auto py-2 divide-y divide-gray-50 text-slate-700 animate-in fade-in slide-in-from-top-1 duration-150">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <div
                      key={item.type + '-' + item.id}
                      onClick={() => {
                        navigate(item.path);
                        setSearchQuery('');
                        setIsSearchFocused(false);
                      }}
                      className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[12px] font-bold text-slate-950 truncate group-hover:text-orange-500 transition-colors">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        )}
                      </div>

                      {/* Badge tags */}
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        item.type === 'Order' ? 'bg-orange-100 text-orange-600 border border-orange-200/50' :
                        item.type === 'Brand' ? 'bg-indigo-100 text-indigo-600 border border-indigo-200/50' :
                        item.type === 'Seller' ? 'bg-emerald-100 text-emerald-600 border border-emerald-200/50' :
                        'bg-blue-100 text-blue-600 border border-blue-200/50'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-5 text-center text-[11px] text-gray-400 font-medium">
                    No matching results found
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3">
               <span className="bg-app-accent/10 text-app-accent px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                 {currentRole.replace('_', ' ')}
               </span>
               <div className="text-right">
                  <div className="text-[13px] font-semibold">{profile?.displayName || 'Guest'}</div>
                  <div className="text-[11px] text-app-text-secondary">{profile?.email}</div>
               </div>
             </div>
             <button
               onClick={() => triggerOpenInbox()}
               className="w-8 h-8 rounded-full bg-app-card border border-app-border flex items-center justify-center hover:bg-slate-800 hover:border-slate-450 active:scale-95 cursor-pointer relative shrink-0 transition-all text-app-text-primary"
               title="Open Messenger"
             >
               <MessageCircle className="w-4 h-4 text-app-text-secondary" />
               {unreadTotal > 0 && (
                 <span id="NotificationBadge" className="absolute -top-1 -right-1 bg-[#F97316] text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-app-bg NotificationBadge">
                   {unreadTotal}
                 </span>
               )}
             </button>

             <div className="w-8 h-8 rounded-full bg-app-card border border-app-border flex items-center justify-center">
                <div className="relative">
                  <Bell className="w-4 h-4 text-app-text-secondary" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-app-accent rounded-full border-2 border-app-bg" />
                </div>
             </div>
          </div>
        </header>

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
