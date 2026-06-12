import React, { useState } from 'react';
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
  Sun,
  Moon,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCMS } from '../contexts/CMSContext';

interface SidebarItem {
  label: string;
  type?: 'label';
  icon?: any;
  path?: string;
  badge?: number;
  subItems?: { label: string; path: string; badge?: number }[];
}

const roleMenus: Record<UserRole, SidebarItem[]> = {
  super_admin: [
    { label: 'Main', type: 'label' },
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Orders Overview', icon: ListOrdered, path: '/admin/orders-overview' },
    { 
      label: 'Users', 
      icon: Users, 
      path: '/admin/consumers',
      subItems: [
        { label: 'Consumers (Buyers)', path: '/admin/consumers' },
        { label: 'Creators', path: '/admin/creators' },
        { label: 'Sellers', path: '/admin/sellers' },
        { label: 'Admins', path: '/admin/admins' }
      ]
    },
    { 
      label: 'Retail Sellers', 
      icon: Building2, 
      path: '/admin/sellers',
      subItems: [
        { label: 'All Retail Sellers', path: '/admin/sellers' },
        { label: 'Seller Requests', path: '/admin/sellers?tab=requests' },
        { label: 'Active Sellers', path: '/admin/sellers?tab=active' },
        { label: 'Seller Performance', path: '/admin/sellers?tab=performance' },
        { label: 'Retail Products', path: '/admin/sellers?tab=products' },
        { label: 'Retail Deals', path: '/admin/sellers?tab=deals' },
        { label: 'Retail Orders', path: '/admin/sellers?tab=orders' },
        { label: 'Flagged Sellers', path: '/admin/sellers?tab=flagged' },
        { label: 'Seller Warnings', path: '/admin/sellers?tab=warnings' },
        { label: 'Suspended Sellers', path: '/admin/sellers?tab=suspended' },
        { label: 'Blacklisted Sellers', path: '/admin/sellers?tab=banned' }
      ]
    },
    { label: 'Content', type: 'label' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Finance', type: 'label' },
    { label: 'Affiliate & Payouts', icon: LinkIcon, path: '/admin/payouts' },
    { label: 'System Ad Operations', type: 'label' },
    { 
      label: 'Sponsored Promotions', 
      icon: Megaphone, 
      path: '/admin/promotions',
      subItems: [
        { label: 'Sponsored Brands', path: '/admin/promotions?tab=brands' },
        { label: 'Featured Products', path: '/admin/promotions?tab=products' },
        { label: 'Homepage Campaigns', path: '/admin/promotions?tab=homepage' },
        { label: 'Promotion Requests', path: '/admin/promotions?tab=requests' },
        { label: 'Campaign Approvals', path: '/admin/promotions?tab=approvals' },
        { label: 'Active Campaigns', path: '/admin/promotions?tab=active' },
        { label: 'Expired Campaigns', path: '/admin/promotions?tab=expired' },
        { label: 'Sponsorship Revenue', path: '/admin/promotions?tab=revenue' }
      ]
    },
    { label: 'CMS', icon: Globe, path: '/admin/cms' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages', badge: 12 },
    { 
      label: 'Analytics', 
      icon: BarChart3, 
      path: '/admin/analytics',
      subItems: [
        { label: 'Platform Overview', path: '/admin/analytics' },
        { label: 'Retail Analytics', path: '/admin/analytics?tab=retail' },
        { label: 'Wholesale Analytics', path: '/admin/analytics?tab=wholesale' },
        { label: 'Buyer Analytics', path: '/admin/analytics?tab=buyer' },
        { label: 'Seller Analytics', path: '/admin/analytics?tab=seller' },
        { label: 'Product Analytics', path: '/admin/analytics?tab=product' },
        { label: 'Revenue Analytics', path: '/admin/analytics?tab=revenue' },
        { label: 'Ad Analytics', path: '/admin/analytics?tab=ad' },
        { label: 'Search Trends', path: '/admin/analytics?tab=search' },
        { label: 'Conversion Metrics', path: '/admin/analytics?tab=conversion' },
        { label: 'Fraud Monitoring', path: '/admin/analytics?tab=fraud' }
      ]
    },
    { label: 'Notifications', icon: Bell, path: '/admin/notifications', badge: 3 },
    { 
      label: 'Moderation Center', 
      icon: ShieldCheck, 
      path: '/admin/moderation',
      badge: 127,
      subItems: [
        { label: 'Product Moderation', path: '/admin/moderation?tab=products' },
        { label: 'Seller Moderation', path: '/admin/moderation?tab=verification' },
        { label: 'Buyer Reports', path: '/admin/moderation?tab=reports' },
        { label: 'Dispute Queue', path: '/admin/moderation?tab=disputes' },
        { label: 'Escalation Queue', path: '/admin/moderation?tab=escalation' },
        { label: 'Warning Center', path: '/admin/moderation?tab=warnings' },
        { label: 'Blacklist Center', path: '/admin/moderation?tab=blacklist' }
      ]
    },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  seller: [
    { label: 'Marketplace', type: 'label' },
    { label: 'Store Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'My Products', icon: Package, path: '/admin/products' },
    { label: 'Add Product', icon: PlusCircle, path: '/admin/products/new' },
    { label: 'Orders', icon: ListOrdered, path: '/admin/orders', badge: 4 },
    { label: 'Customers', icon: Users, path: '/admin/customers' },
    { label: 'Settings', type: 'label' },
    { label: 'Earnings', icon: Wallet, path: '/admin/payouts' },
    { label: 'Storefront', icon: Globe, path: '/admin/storefront' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages', badge: 2 },
  ],
  creator: [
    { label: 'Creative Hub', type: 'label' },
    { label: 'Creator Home', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'My Content', icon: FileText, path: '/admin/content' },
    { label: 'Collaborations', icon: ShieldCheck, path: '/admin/collabs', badge: 1 },
    { label: 'Performance', type: 'label' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Payouts', icon: Wallet, path: '/admin/payouts' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages' },
  ],
  moderator: [
    { label: 'Admin Moderation', type: 'label' },
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Moderation Queue', icon: ShieldCheck, path: '/admin/moderation', badge: 127 },
    { label: 'Retail Sellers', icon: Building2, path: '/admin/sellers' },
    { label: 'Reviews', icon: Star, path: '/admin/reviews' },
    { label: 'Messages', icon: MessageCircle, path: '/admin/messages', badge: 12 },
  ],
  finance_manager: [
    { label: 'Corporate Finance', type: 'label' },
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Orders Overview', icon: ListOrdered, path: '/admin/orders-overview' },
    { label: 'Affiliate & Payouts', icon: Wallet, path: '/admin/payouts' },
    { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  ],
  support_agent: [
    { label: 'Platform Support', type: 'label' },
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Support Messages', icon: MessageCircle, path: '/admin/messages', badge: 12 },
    { label: 'Notifications', icon: Bell, path: '/admin/notifications', badge: 3 },
    { label: 'Reviews Feed', icon: Star, path: '/admin/reviews' },
  ],
  marketing_manager: [
    { label: 'Promotional Hub', type: 'label' },
    { label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Ads & Sponsors', icon: Megaphone, path: '/admin/ads-sponsors' },
    { label: 'Deals & Coupons', icon: Tag, path: '/admin/sellers?tab=deals' },
    { label: 'Recommendations', icon: Lightbulb, path: '/admin/recommendations' },
    { label: 'CMS Manager', icon: Globe, path: '/admin/cms' },
  ]
};

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { cmsData } = useCMS();
  const location = useLocation();
  const navigate = useNavigate();
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

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
  const sidebarItems = roleMenus[currentRole as UserRole] || [];

  const handleSwitchRole = (role: UserRole) => {
    switchRole(role);
    setShowRoleSwitcher(false);
    navigate('/admin/dashboard');
  };

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
      <aside className="w-[240px] h-full bg-app-sidebar flex flex-col shrink-0 border-r border-app-border overflow-hidden">
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
                <div key={idx} className="text-[10px] font-bold text-slate-500 px-3 pt-6 pb-2 uppercase tracking-widest">
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon!;
            const hasSub = item.subItems && item.subItems.length > 0;
            
            const isParentActive = item.path 
              ? (item.path === '/admin/dashboard' 
                  ? location.pathname === '/admin/dashboard' 
                  : location.pathname === item.path || location.pathname.startsWith(item.path + '/')) 
              : false;
            
            const isChildActive = item.subItems?.some(sub => {
              const [subPath, subQuery] = sub.path.split('?');
              const pathMatches = location.pathname === subPath;
              if (subQuery) {
                const searchParam = subQuery.split('=')[1];
                const cleanSearch = location.search.replace('?', '');
                return pathMatches && cleanSearch.includes(searchParam);
              }
              return pathMatches;
            }) || false;

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
                        ? 'bg-gradient-to-r from-app-accent/15 via-app-accent/5 to-transparent text-white border-app-accent' 
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                      isActive 
                        ? 'text-app-accent scale-110 drop-shadow-[0_0_8px_rgba(235,69,1,0.4)]' 
                        : 'text-slate-400 group-hover:text-white'
                    }`} />
                    <span className={`transition-colors duration-300 flex-1 ${isActive ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-white'}`}>
                      {item.label}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-transform ${isCurrentlyExpanded ? 'rotate-90 text-app-accent' : ''}`} />
                  </button>
                ) : (
                  <NavLink
                    to={item.path!}
                    className={`group flex items-center gap-3 px-3.5 py-3 text-[13px] font-medium rounded-r-lg border-l-4 transition-all duration-300 ${
                      isActive 
                        ? 'active-sidebar-item bg-gradient-to-r from-app-accent/15 via-app-accent/5 to-transparent text-white border-app-accent shadow-[0_4px_16px_rgba(235,69,1,0.08)]' 
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                      isActive 
                        ? 'text-app-accent scale-110 drop-shadow-[0_0_8px_rgba(235,69,1,0.4)]' 
                        : 'text-slate-400 group-hover:text-white group-hover:scale-105'
                    }`} />
                    <span className={`transition-colors duration-300 ${isActive ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-white'}`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="ml-auto bg-app-accent text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )}

                {hasSub && isCurrentlyExpanded && item.subItems && (
                  <div className="mt-1 pl-6 space-y-1 bg-white/[0.01] border-l border-white/[0.04] ml-5 rounded-bl-sm">
                    {item.subItems.map((sub, sIdx) => {
                      const [subPath, subQuery] = sub.path.split('?');
                      const isSubActive = location.pathname === subPath && 
                        (!subQuery || location.search.includes(subQuery.split('=')[1]));
                      
                      return (
                        <NavLink
                          key={sIdx}
                          to={sub.path}
                          className={`flex items-center gap-2 py-2 px-3 text-[11px] font-medium rounded-md transition-all ${
                            isSubActive 
                              ? 'text-app-accent font-bold bg-white/[0.03]' 
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
                          }`}
                        >
                          <ChevronRight className={`w-2.5 h-2.5 ${isSubActive ? 'text-app-accent rotate-90 scale-110' : 'text-slate-500 opacity-60'}`} />
                          <span className="truncate">{sub.label}</span>
                          {sub.badge && (
                            <span className="ml-auto bg-app-accent/20 text-app-accent text-[8px] px-1 py-0.2 rounded font-black">
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
            <p className="text-slate-500 text-[9px] truncate">{profile?.email || 'user@example.com'}</p>
          </div>
          <button onClick={handleLogout} className="text-app-text-secondary hover:text-white transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        <header className="h-[64px] px-8 flex items-center justify-between shrink-0 mb-2 border-b border-app-border bg-app-bg/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex flex-col">
            <div className="text-[12px] text-app-text-secondary opacity-60">
              {currentRole.replace('_', ' ').toUpperCase()} / Dashboard / {location.pathname.split('/').pop()?.replace('-', ' ')}
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button
               onClick={toggleTheme}
               className="w-10 h-10 rounded-xl bg-app-card border border-app-border flex items-center justify-center hover:bg-app-accent group transition-all"
               title={`Switch to ${theme === 'light' ? 'Night' : 'Light'} Mode`}
             >
               {theme === 'light' ? (
                 <Moon className="w-5 h-5 text-app-text-secondary group-hover:text-white transition-colors" />
               ) : (
                 <Sun className="w-5 h-5 text-app-text-secondary group-hover:text-white transition-colors" />
               )}
             </button>
             <div className="flex items-center gap-3">
               <span className="bg-app-accent/10 text-app-accent px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                 {currentRole.replace('_', ' ')}
               </span>
               <div className="text-right">
                  <div className="text-[13px] font-semibold">{profile?.displayName || 'Guest'}</div>
                  <div className="text-[11px] text-app-text-secondary">{profile?.email}</div>
               </div>
             </div>
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
