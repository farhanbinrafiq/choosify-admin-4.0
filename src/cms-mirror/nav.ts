/** Exact navDefs + pageMeta from Choosify Admin CMS (standalone).html */

export type CmsNavItem = {
  key: string;
  label: string;
  tag?: string;
  path: string;
};

export type CmsNavGroup = {
  title: string;
  items: CmsNavItem[];
};

/** HTML page key → React Router path */
export const PAGE_KEY_TO_PATH: Record<string, string> = {
  dashboard: '/admin/dashboard',
  customers: '/admin/consumers',
  creators: '/admin/creator-studio',
  creatorProfile: '/admin/creator-profile',
  creatorEconomy: '/admin/creator-hub',
  brands: '/admin/brand-studio',
  brandProfile: '/admin/brand-profile',
  products: '/admin/products',
  categories: '/admin/categories',
  orders: '/admin/orders',
  sellerCustomers: '/admin/customers',
  returnsRefunds: '/admin/returns',
  adsDealsStudio: '/admin/ads-deals-studio',
  contentStudio: '/admin/guides',
  courierProviders: '/admin/logistics/couriers',
  shipmentOperations: '/admin/logistics/shipments',
  courierAnalytics: '/admin/logistics/analytics',
  reviews: '/admin/reviews',
  moderationCenter: '/admin/moderation',
  disputes: '/admin/disputes',
  trustCenter: '/admin/trust-center',
  messages: '/admin/messages',
  notifications: '/admin/notifications',
  finance: '/admin/analytics',
  feeCharges: '/admin/fee-charges',
  payouts: '/admin/payouts',
  myCashbook: '/admin/cashbook',
  adminManagement: '/admin/admins',
  verificationCenter: '/admin/brand-verification',
  subscriptionPlans: '/admin/promotions',
  monetizationCenter: '/admin/monetization',
  promoCodes: '/admin/coupons',
  auditLogs: '/admin/audit-logs',
  websiteCmsStudio: '/admin/website-cms',
  settings: '/admin/settings',
};

export const PATH_TO_PAGE_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_KEY_TO_PATH).map(([k, v]) => [v, k]),
);

/** Resolve CMS page key, or `null` when the path is unknown (show storefront-parity 404). */
export function resolveAdminPageKey(pathname: string): string | null {
  const exact = PATH_TO_PAGE_KEY[pathname];
  if (exact) return exact;

  // Prefix matches for nested detail routes
  if (pathname.startsWith('/admin/consumers')) return 'customers';
  if (pathname.startsWith('/admin/brand-profile')) return 'brandProfile';
  // Admin Brand Profile (standalone CMS Brand Detail) — not Brand Studio editor
  if (pathname.startsWith('/admin/brand-detail')) return 'brands';
  if (pathname.startsWith('/admin/brand-studio')) return 'brands';
  if (pathname.startsWith('/admin/sellers') || pathname.startsWith('/admin/brand-profiles')) return 'brands';
  if (pathname.startsWith('/admin/products')) return 'products';
  if (pathname.startsWith('/admin/orders')) return 'orders';
  if (pathname.startsWith('/admin/creator-profile')) return 'creatorProfile';
  if (pathname.startsWith('/admin/creator-studio')) return 'creators';
  if (pathname.startsWith('/admin/creators-hub') || pathname.startsWith('/admin/creators')) return 'creators';
  if (pathname.startsWith('/admin/creator-hub') || pathname.startsWith('/admin/creator-earnings')) return 'creatorEconomy';
  if (pathname.startsWith('/admin/returns')) return 'returnsRefunds';
  if (pathname.startsWith('/admin/customers')) return 'sellerCustomers';
  if (pathname.startsWith('/admin/coupons')) return 'promoCodes';
  if (pathname.startsWith('/admin/reviews')) return 'reviews';
  if (pathname.startsWith('/admin/messages')) return 'messages';
  if (pathname.startsWith('/admin/analytics')) return 'finance';
  if (pathname.startsWith('/admin/cashbook')) return 'myCashbook';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  if (pathname.startsWith('/admin/recommendations')) return 'contentStudio';
  if (pathname.startsWith('/admin/guides')) return 'contentStudio';
  if (pathname.startsWith('/admin/categories')) return 'categories';
  if (pathname.startsWith('/admin/ads-deals-studio')) return 'adsDealsStudio';
  if (pathname.startsWith('/admin/logistics/couriers')) return 'courierProviders';
  if (pathname.startsWith('/admin/logistics/shipments') || pathname.startsWith('/admin/logistics/tracking') || pathname.startsWith('/admin/logistics/labels')) {
    return 'shipmentOperations';
  }
  if (pathname.startsWith('/admin/logistics')) return 'shipmentOperations';
  if (pathname.startsWith('/admin/website-cms') || pathname.startsWith('/admin/cms')) return 'websiteCmsStudio';
  if (pathname.startsWith('/admin/moderation')) return 'moderationCenter';
  if (pathname.startsWith('/admin/disputes')) return 'disputes';
  if (pathname.startsWith('/admin/trust-center')) return 'trustCenter';
  if (pathname.startsWith('/admin/notifications')) return 'notifications';
  if (pathname.startsWith('/admin/fee-charges')) return 'feeCharges';
  if (pathname.startsWith('/admin/payouts')) return 'payouts';
  if (pathname.startsWith('/admin/admins')) return 'adminManagement';
  if (pathname.startsWith('/admin/brand-verification')) return 'verificationCenter';
  if (pathname.startsWith('/admin/promotions')) return 'subscriptionPlans';
  if (pathname.startsWith('/admin/monetization')) return 'monetizationCenter';
  if (pathname.startsWith('/admin/audit-logs')) return 'auditLogs';
  if (pathname.startsWith('/dashboard/content-studio')) return 'contentStudio';
  if (pathname.startsWith('/seller')) return 'products';

  return null;
}

export function pathToPageKey(pathname: string): string {
  return resolveAdminPageKey(pathname) ?? 'dashboard';
}

/**
 * Page keys allowed in the CMS mirror sidebar per role.
 * Mapped from existing AdminLayout seller/creator menus → admin mirror screens.
 * `null` = full admin nav (no filter).
 */
export const ROLE_ALLOWED_PAGE_KEYS: Record<string, string[] | null> = {
  super_admin: null,
  admin: null,
  seller: [
    'dashboard',
    'brands',
    'brandProfile',
    'products',
    'orders',
    'sellerCustomers',
    'returnsRefunds',
    'promoCodes',
    'messages',
    'notifications',
    'reviews',
    'finance',
    'courierProviders',
    'shipmentOperations',
    'courierAnalytics',
    'myCashbook',
    'settings',
  ],
  creator: [
    'dashboard',
    'creators', // Creator Studio → live storefront profile editor (not guides)
    'creatorProfile', // Creator Profile (account / verification / listings / earnings)
    'contentStudio',
    'creatorEconomy',
    'messages',
    'notifications',
    'reviews',
    'finance',
    'myCashbook',
    'settings',
  ],
  moderator: ['dashboard', 'moderationCenter', 'reviews', 'messages'],
  finance_manager: ['dashboard', 'payouts', 'feeCharges', 'finance'],
  support_agent: ['dashboard', 'messages', 'reviews'],
  marketing_manager: ['dashboard', 'adsDealsStudio', 'promoCodes', 'websiteCmsStudio'],
};

export function allowedPageKeysForRole(role: string | undefined | null): string[] | null {
  if (!role) return null;
  return ROLE_ALLOWED_PAGE_KEYS[role] ?? null;
}

export const NAV_DEFS: CmsNavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [{ key: 'dashboard', label: 'Dashboard', path: PAGE_KEY_TO_PATH.dashboard }],
  },
  {
    title: 'PEOPLE',
    items: [
      { key: 'customers', label: 'Consumers', path: PAGE_KEY_TO_PATH.customers },
      { key: 'creators', label: 'Creators', path: PAGE_KEY_TO_PATH.creators },
      { key: 'creatorEconomy', label: 'Creator Economy', path: PAGE_KEY_TO_PATH.creatorEconomy },
    ],
  },
  {
    title: 'BRAND & CATALOG',
    items: [
      { key: 'brands', label: 'Seller Management Studio', path: PAGE_KEY_TO_PATH.brands },
      { key: 'products', label: 'Products & Inventory', path: PAGE_KEY_TO_PATH.products },
      { key: 'categories', label: 'Category Management Studio', path: PAGE_KEY_TO_PATH.categories },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { key: 'orders', label: 'Orders Hub', path: PAGE_KEY_TO_PATH.orders },
      { key: 'returnsRefunds', label: 'Returns & Refunds', path: PAGE_KEY_TO_PATH.returnsRefunds },
    ],
  },
  {
    title: 'MARKETING & CONTENT',
    items: [
      { key: 'adsDealsStudio', label: 'Ads & Deals Studio', tag: 'NEW', path: PAGE_KEY_TO_PATH.adsDealsStudio },
      { key: 'contentStudio', label: 'Guide Management', tag: 'NEW', path: PAGE_KEY_TO_PATH.contentStudio },
    ],
  },
  {
    title: 'LOGISTICS MANAGEMENT',
    items: [
      { key: 'courierProviders', label: 'Courier Providers', path: PAGE_KEY_TO_PATH.courierProviders },
      { key: 'shipmentOperations', label: 'Shipment Operations', path: PAGE_KEY_TO_PATH.shipmentOperations },
      { key: 'courierAnalytics', label: 'Courier Analytics', path: PAGE_KEY_TO_PATH.courierAnalytics },
    ],
  },
  {
    title: 'TRUST & SAFETY',
    items: [
      { key: 'reviews', label: 'Reviews', path: PAGE_KEY_TO_PATH.reviews },
      { key: 'moderationCenter', label: 'Moderation Center', path: PAGE_KEY_TO_PATH.moderationCenter },
      { key: 'disputes', label: 'Disputes', path: PAGE_KEY_TO_PATH.disputes },
      { key: 'trustCenter', label: 'Trust & Analytics', path: PAGE_KEY_TO_PATH.trustCenter },
    ],
  },
  {
    title: 'COMMUNICATION',
    items: [
      { key: 'messages', label: 'Messages', tag: '12', path: PAGE_KEY_TO_PATH.messages },
      { key: 'notifications', label: 'Notifications', path: PAGE_KEY_TO_PATH.notifications },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { key: 'finance', label: 'Finance', path: PAGE_KEY_TO_PATH.finance },
      { key: 'feeCharges', label: 'Fee & Charges Engine', tag: 'NEW', path: PAGE_KEY_TO_PATH.feeCharges },
      { key: 'payouts', label: 'Payouts', path: PAGE_KEY_TO_PATH.payouts },
      { key: 'myCashbook', label: 'My Cashbook', tag: 'PRIVATE', path: PAGE_KEY_TO_PATH.myCashbook },
    ],
  },
  {
    title: 'SUPER ADMIN CORE',
    items: [
      { key: 'adminManagement', label: 'Admin Management', path: PAGE_KEY_TO_PATH.adminManagement },
      { key: 'verificationCenter', label: 'Verification Center', path: PAGE_KEY_TO_PATH.verificationCenter },
      { key: 'subscriptionPlans', label: 'Subscription Plans', path: PAGE_KEY_TO_PATH.subscriptionPlans },
      { key: 'monetizationCenter', label: 'Monetization Center', path: PAGE_KEY_TO_PATH.monetizationCenter },
      { key: 'promoCodes', label: 'Promo Codes & Vouchers', path: PAGE_KEY_TO_PATH.promoCodes },
      { key: 'auditLogs', label: 'Audit Logs', path: PAGE_KEY_TO_PATH.auditLogs },
    ],
  },
  {
    title: 'WEBSITE',
    items: [
      { key: 'websiteCmsStudio', label: 'Website Manager', tag: 'NEW', path: PAGE_KEY_TO_PATH.websiteCmsStudio },
    ],
  },
  {
    title: 'SETTINGS',
    items: [{ key: 'settings', label: 'Settings', path: PAGE_KEY_TO_PATH.settings }],
  },
];

export const PAGE_META: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Overview of store performance'],
  products: ['Products & Inventory', 'Manage your product catalog and stock'],
  brands: ['Seller Management Studio', 'Platform seller and brand governance'],
  brandProfile: ['Seller Profile', 'Your seller account, verification, products, and earnings'],
  categories: ['Category Management Studio', 'Organize your catalog'],
  creators: ['Creators', 'Manage creator partnerships'],
  creatorProfile: ['Creator Profile', 'Your creator account, verification, listings, and earnings'],
  deals: ['Deals', 'Promotions and discounts'],
  orders: ['Orders Hub', 'Track and fulfill customer orders'],
  customers: ['Consumers', 'View and manage customer accounts'],
  settings: ['Settings', 'Store configuration'],
  websiteCmsStudio: ['Website Manager', 'Manage homepage banners, pages, and site content'],
  adsDealsStudio: ['Ads & Deals Studio', 'Manage promoted ads, deals, coupons, and paid placements'],
  contentStudio: ['Guide Management', 'Manage videos, reels, blogs, and live sessions'],
  messages: ['Messages', 'Unified channels routing hub'],
  returnsRefunds: ['Returns & Refunds', 'Audit customer return complaints and process refunds'],
  inventoryStock: ['Inventory & Stock', 'Real-time multi-channel inventory control'],
  reviews: [
    'Platform Admin Review Console',
    'Manage client reviews, verify content authenticity, detect fake feedback, and lock spam agents',
  ],
  promoCodes: [
    'Promo Vouchers Engine',
    'Configure dynamic checkout coupon codes, specify cart spend rules, track campaign redemptions, and monitor marketing conversion analytics',
  ],
  auditLogs: [
    'Security Audit Trail Logs',
    'Comprehensive tamper-proof back-office administrative operations and session history ledger tracking',
  ],
  payouts: ['Payouts', 'Review and settle seller sales and creator affiliate payout requests'],
  feeCharges: [
    'Fee & Charges Engine',
    'Apply service charges, platform fees, tax, and delivery charges platform-wide, by brand, category, or product',
  ],
  notifications: ['Notifications', 'Blast announcements, alerts, and promos to platform users'],
  creatorEconomy: [
    'Creator Economy & Recommendation Analytics',
    'Affiliate commission attribution, campaign, and partnership management',
  ],
  sellerCustomers: [
    'Seller-Scoped Customer Directory',
    'Buyer analytics, segments, and secure messaging per storefront',
  ],
  moderationCenter: ['Moderation Center', 'Flagged content awaiting review'],
  disputes: ['Disputes', 'Buyer/seller disputes requiring resolution'],
  trustCenter: ['Trust & Analytics', 'Platform trust metrics and safety alerts'],
  finance: ['Finance', 'Platform financial overview'],
  adminManagement: ['Admin Management', 'Manage admin accounts and access'],
  verificationCenter: ['Verification Center', 'Seller & brand identity verification queue'],
  subscriptionPlans: ['Subscription Plans', 'Seller & brand subscription tiers'],
  monetizationCenter: ['Monetization Center', 'Ad placements and promoted listings'],
  courierProviders: ['Courier Providers', 'Manage integrated delivery partners'],
  shipmentOperations: ['Shipment Operations', 'Active shipments across all couriers'],
  courierAnalytics: ['Courier Analytics', 'Delivery performance by courier partner'],
  myCashbook: ['My Cashbook', 'Private cashbook ledger'],
};
