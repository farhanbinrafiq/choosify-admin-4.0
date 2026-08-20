import { PARTNER_FEATURES, type PartnerRole } from '../../shared/entitlements/registry';

/** Exact navDefs + pageMeta from Choosify Admin CMS (standalone).html */

export type NavLockReason = 'marketplace' | 'entitlement';

export type CmsNavItem = {
  key: string;
  label: string;
  tag?: string;
  path: string;
  /** Visible-but-disabled annotation. Never hide role allowlist for marketplace lock. */
  lock?: NavLockReason;
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
  consumerProfile: '/admin/consumer-profile',
  creatorEconomy: '/admin/creator-hub',
  brands: '/admin/brand-studio',
  brandProfile: '/admin/brand-profile',
  products: '/admin/products',
  categories: '/admin/categories',
  orders: '/admin/orders',
  sellerCustomers: '/admin/customers',
  returnsRefunds: '/admin/returns',
  warrantyClaims: '/admin/warranty-claims',
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
  myEarnings: '/admin/my-earnings',
  feesAdjustments: '/admin/fees-adjustments',
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
  adminProfile: '/admin/profile',
  featureAccess: '/admin/feature-access',
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
  if (pathname.startsWith('/admin/consumer-profile')) return 'consumerProfile';
  if (pathname.startsWith('/admin/creator-studio')) return 'creators';
  if (pathname.startsWith('/admin/creators-hub') || pathname.startsWith('/admin/creators')) return 'creators';
  if (pathname.startsWith('/admin/creator-hub') || pathname.startsWith('/admin/creator-earnings')) return 'creatorEconomy';
  if (pathname.startsWith('/admin/returns')) return 'returnsRefunds';
  if (pathname.startsWith('/admin/warranty-claims')) return 'warrantyClaims';
  if (pathname.startsWith('/admin/customers')) return 'sellerCustomers';
  if (pathname.startsWith('/admin/coupons')) return 'promoCodes';
  if (pathname.startsWith('/admin/reviews')) return 'reviews';
  if (pathname.startsWith('/admin/messages')) return 'messages';
  if (pathname.startsWith('/admin/analytics')) return 'finance';
  if (pathname.startsWith('/admin/my-earnings')) return 'myEarnings';
  if (pathname.startsWith('/admin/fees-adjustments')) return 'feesAdjustments';
  if (pathname.startsWith('/admin/cashbook')) return 'myCashbook';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  if (pathname.startsWith('/admin/profile') || pathname.startsWith('/admin/account/profile')) return 'adminProfile';
  if (pathname.startsWith('/admin/recommendations')) return 'contentStudio';
  if (pathname.startsWith('/admin/guides')) return 'contentStudio';
  if (pathname.startsWith('/admin/categories')) return 'categories';
  if (pathname.startsWith('/admin/ads-studio')) return 'adsDealsStudio';
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
  if (pathname.startsWith('/admin/feature-access')) return 'featureAccess';
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
    'contentStudio',
    'adsDealsStudio',
    'orders',
    'sellerCustomers',
    'returnsRefunds',
    'warrantyClaims',
    'promoCodes',
    'messages',
    'notifications',
    'reviews',
    'finance',
    'myEarnings',
    'feesAdjustments',
    'payouts',
    'courierProviders',
    'shipmentOperations',
    'courierAnalytics',
    'myCashbook',
    'settings',
  ],
  creator: [
    'dashboard',
    'creators', // Creator Studio → live storefront profile editor (not guides)
    'creatorProfile', // Creator Profile (account / verification / listings)
    'contentStudio',
    'adsDealsStudio',
    'creatorEconomy',
    'sellerCustomers',
    'messages',
    'notifications',
    'reviews',
    'finance',
    'myEarnings',
    'feesAdjustments',
    'payouts',
    'myCashbook',
    'settings',
  ],
  consumer: ['dashboard', 'orders', 'consumerProfile', 'settings'],
  moderator: ['dashboard', 'moderationCenter', 'reviews', 'messages', 'adminProfile'],
  finance_manager: ['dashboard', 'payouts', 'feeCharges', 'finance', 'adminProfile'],
  support_agent: ['dashboard', 'messages', 'reviews', 'adminProfile'],
  marketing_manager: ['dashboard', 'adsDealsStudio', 'promoCodes', 'websiteCmsStudio', 'adminProfile'],
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
    title: 'ACCOUNT MANAGEMENT',
    items: [
      { key: 'brands', label: 'Seller Management Studio', path: PAGE_KEY_TO_PATH.brands },
      { key: 'creators', label: 'Creators Management', path: PAGE_KEY_TO_PATH.creators },
      { key: 'customers', label: 'Consumer Management', path: PAGE_KEY_TO_PATH.customers },
      { key: 'creatorEconomy', label: 'Creator Economy', path: PAGE_KEY_TO_PATH.creatorEconomy },
      { key: 'consumerProfile', label: 'My Profile', path: PAGE_KEY_TO_PATH.consumerProfile },
    ],
  },
  {
    title: 'BRAND & CATALOG',
    items: [
      { key: 'products', label: 'Products & Inventory', path: PAGE_KEY_TO_PATH.products },
      { key: 'categories', label: 'Category Management Studio', path: PAGE_KEY_TO_PATH.categories },
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      { key: 'orders', label: 'Orders Hub', path: PAGE_KEY_TO_PATH.orders },
      { key: 'returnsRefunds', label: 'Returns & Refunds', path: PAGE_KEY_TO_PATH.returnsRefunds },
      { key: 'warrantyClaims', label: 'Warranty Claims', path: PAGE_KEY_TO_PATH.warrantyClaims },
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
      { key: 'messages', label: 'Messages', path: PAGE_KEY_TO_PATH.messages },
      { key: 'notifications', label: 'Notifications', path: PAGE_KEY_TO_PATH.notifications },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { key: 'finance', label: 'Finance', path: PAGE_KEY_TO_PATH.finance },
      { key: 'feesAdjustments', label: 'Fees & Adjustments', path: PAGE_KEY_TO_PATH.feesAdjustments },
      { key: 'feeCharges', label: 'Fee & Charges Engine', tag: 'NEW', path: PAGE_KEY_TO_PATH.feeCharges },
      { key: 'payouts', label: 'Payouts', path: PAGE_KEY_TO_PATH.payouts },
      { key: 'myCashbook', label: 'Cashbook Hub', tag: 'PRIVATE', path: PAGE_KEY_TO_PATH.myCashbook },
    ],
  },
  {
    title: 'SUPER ADMIN CORE',
    items: [
      { key: 'adminManagement', label: 'Admin Management', path: PAGE_KEY_TO_PATH.adminManagement },
      { key: 'featureAccess', label: 'Feature Access & Entitlements', path: PAGE_KEY_TO_PATH.featureAccess },
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
    items: [
      { key: 'adminProfile', label: 'Admin Profile', path: PAGE_KEY_TO_PATH.adminProfile },
      { key: 'settings', label: 'Settings', path: PAGE_KEY_TO_PATH.settings },
    ],
  },
];

export const PAGE_META: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Overview of store performance'],
  products: ['Products & Inventory', 'Manage your product catalog and stock'],
  brands: ['Seller Management Studio', 'Platform seller and brand governance'],
  brandProfile: ['Seller Profile', 'Your seller account, verification, and profile settings'],
  categories: ['Category Management Studio', 'Organize your catalog'],
  creators: ['Creators Management', 'Manage creator partnerships'],
  creatorProfile: ['Creator Profile', 'Your creator account, verification, and profile settings'],
  consumerProfile: ['My Profile', 'Your consumer account, orders preference, and security settings'],
  deals: ['Deals', 'Promotions and discounts'],
  orders: ['Orders Hub', 'Track and fulfill customer orders'],
  customers: ['Consumer Management', 'View and manage customer accounts'],
  settings: ['Settings', 'Store configuration'],
  adminProfile: ['Admin Profile', 'Account, security, RBAC scope, and preferences'],
  websiteCmsStudio: ['Website Manager', 'Manage homepage banners, pages, and site content'],
  adsDealsStudio: ['Ads & Deals Studio', 'Manage promoted ads, deals, coupons, and paid placements'],
  contentStudio: ['Guide Management', 'Manage videos, reels, blogs, and live sessions'],
  messages: ['Messages', 'Unified channels routing hub'],
  returnsRefunds: ['Returns & Refunds', 'Audit customer return complaints and process refunds'],
  warrantyClaims: ['Warranty Claims', 'Review and resolve customer warranty claims'],
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
    'My Customers',
    'Buyers you have served through orders and bookings',
  ],
  moderationCenter: ['Moderation Center', 'Flagged content awaiting review'],
  disputes: ['Disputes', 'Buyer/seller disputes requiring resolution'],
  trustCenter: ['Trust & Analytics', 'Platform trust metrics and safety alerts'],
  finance: ['Finance & Payouts', 'Current eligible earnings, commission, and net withdrawable'],
  myEarnings: ['My Earnings', 'Earnings overview and payout Payment Info'],
  feesAdjustments: ['Fees & Adjustments', 'Authoritative current deductions and credits'],
  adminManagement: ['Admin Management', 'Manage admin accounts and access'],
  featureAccess: [
    'Feature Access & Entitlements',
    'Manage which platform features are enabled per role and plan',
  ],
  verificationCenter: ['Verification Center', 'Seller & brand identity verification queue'],
  subscriptionPlans: ['Subscription Plans', 'Seller & brand subscription tiers'],
  monetizationCenter: ['Monetization Center', 'Ad placements and promoted listings'],
  courierProviders: ['Courier Providers', 'Manage integrated delivery partners'],
  shipmentOperations: ['Shipment Operations', 'Active shipments across all couriers'],
  courierAnalytics: ['Courier Analytics', 'Delivery performance by courier partner'],
  myCashbook: ['Cashbook Hub', 'Inspect Seller and Creator cashbook ledgers'],
  shipmentConsole: ['Shipment Console', 'Active shipments across all couriers'],
  trackingCenter: ['Tracking Center', 'Real-time tracking status across all in-flight orders'],
  shippingLabels: ['Shipping Labels', 'Generate and manage printable courier labels'],
  analytics: ['Analytics', 'Platform-wide traffic and engagement'],
};

function navItem(key: string, label: string, tag?: string): CmsNavItem {
  return { key, label, ...(tag ? { tag } : {}), path: PAGE_KEY_TO_PATH[key] || `/admin/${key}` };
}

/**
 * Seller chrome tree (cms-mirror + AdminWorkspaceLayout).
 * Labels/categories match the live partner sidebar — not the Admin catalog.
 */
export const SELLER_NAV_GROUPS: CmsNavGroup[] = [
  { title: 'OVERVIEW', items: [navItem('dashboard', 'Dashboard')] },
  {
    title: 'BRAND & CATALOG',
    items: [
      navItem('brands', 'Brand Management Studio'),
      navItem('brandProfile', 'Seller Profile'),
      navItem('products', 'Products & Inventory'),
      navItem('contentStudio', 'Guide Management'),
      navItem('adsDealsStudio', 'Ads & Deals Studio'),
    ],
  },
  {
    title: 'COMMERCE',
    items: [
      navItem('orders', 'Orders Hub'),
      navItem('sellerCustomers', 'My Customers'),
      navItem('returnsRefunds', 'Returns & Refunds'),
      navItem('warrantyClaims', 'Warranty Claims'),
      navItem('promoCodes', 'Promo Codes & Vouchers'),
    ],
  },
  {
    title: 'LOGISTICS MANAGEMENT',
    items: [
      navItem('courierProviders', 'Courier Providers'),
      navItem('shipmentOperations', 'Shipment Operations'),
      navItem('courierAnalytics', 'Courier Analytics'),
    ],
  },
  { title: 'TRUST & SAFETY', items: [navItem('reviews', 'Reviews')] },
  {
    title: 'COMMUNICATION',
    items: [navItem('messages', 'Messages'), navItem('notifications', 'Notifications')],
  },
  {
    title: 'FINANCE & PAYOUTS',
    items: [
      navItem('finance', 'Finance & Payouts'),
      navItem('myEarnings', 'My Earnings'),
      navItem('myCashbook', 'Cashbooks', 'PRIVATE'),
      navItem('feesAdjustments', 'Fees & Adjustments'),
      navItem('payouts', 'Payouts / Withdrawals'),
    ],
  },
  { title: 'SETTINGS', items: [navItem('settings', 'Settings')] },
];

/** Creator chrome tree (cms-mirror + AdminWorkspaceLayout). */
export const CREATOR_NAV_GROUPS: CmsNavGroup[] = [
  { title: 'OVERVIEW', items: [navItem('dashboard', 'Dashboard')] },
  {
    title: 'PEOPLE',
    items: [
      navItem('creators', 'Creator Studio'),
      navItem('creatorProfile', 'Creator Profile'),
      navItem('creatorEconomy', 'Creator Economy'),
    ],
  },
  { title: 'COMMERCE', items: [navItem('sellerCustomers', 'My Customers')] },
  {
    title: 'MARKETING & CONTENT',
    items: [
      navItem('adsDealsStudio', 'Ads & Deals Studio'),
      navItem('contentStudio', 'Guide Management'),
    ],
  },
  { title: 'TRUST & SAFETY', items: [navItem('reviews', 'Reviews')] },
  {
    title: 'COMMUNICATION',
    items: [navItem('messages', 'Messages'), navItem('notifications', 'Notifications')],
  },
  {
    title: 'FINANCE & PAYOUTS',
    items: [
      navItem('finance', 'Finance & Payouts'),
      navItem('myEarnings', 'My Earnings'),
      navItem('myCashbook', 'Cashbooks', 'PRIVATE'),
      navItem('feesAdjustments', 'Fees & Adjustments'),
      navItem('payouts', 'Payouts / Withdrawals'),
    ],
  },
  { title: 'SETTINGS', items: [navItem('settings', 'Settings')] },
];

export const CONSUMER_NAV_GROUPS: CmsNavGroup[] = [
  { title: 'OVERVIEW', items: [navItem('dashboard', 'Dashboard')] },
  {
    title: 'MY ACCOUNT',
    items: [
      navItem('consumerProfile', 'My Profile'),
      navItem('orders', 'My Orders'),
      navItem('settings', 'Settings'),
    ],
  },
];

/** Super-admin / staff modules that must never appear on Seller or Creator nav. */
export const ADMIN_ONLY_PAGE_KEYS = [
  'adminManagement',
  'featureAccess',
  'verificationCenter',
  'subscriptionPlans',
  'monetizationCenter',
  'auditLogs',
  'websiteCmsStudio',
  'feeCharges',
  'customers',
  'categories',
  'moderationCenter',
  'disputes',
  'trustCenter',
  'adminProfile',
] as const;

export function pageKeysFromNavGroups(groups: CmsNavGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((item) => item.key));
}

/** Page keys with no PARTNER_FEATURES mapping — role access only. */
export function corePageKeysForRole(role: PartnerRole): string[] {
  const gated = new Set(
    PARTNER_FEATURES.filter((f) => f.roles.includes(role)).flatMap((f) => f.pageKeys),
  );
  return (ROLE_ALLOWED_PAGE_KEYS[role] || []).filter((k) => !gated.has(k));
}

/**
 * Role chrome source of truth. Admin catalog (NAV_DEFS) is never used as the
 * Seller/Creator tree — filtering the admin list silently dropped partner-only keys.
 */
export function navGroupsForRole(role: string | undefined): CmsNavGroup[] {
  if (role === 'consumer') return CONSUMER_NAV_GROUPS;
  if (role === 'seller') return SELLER_NAV_GROUPS;
  if (role === 'creator') return CREATOR_NAV_GROUPS;

  const allowed = allowedPageKeysForRole(role);
  if (!allowed) return NAV_DEFS;
  const allow = new Set(allowed);
  return NAV_DEFS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allow.has(item.key)),
  })).filter((group) => group.items.length > 0);
}

/** Hide entitlement-disabled items; drop empty category headings. */
export function applyEntitlementNavFilter(
  groups: CmsNavGroup[],
  filterAllowedPageKeys: (keys: string[] | null) => string[] | null,
  role: string | undefined,
): CmsNavGroup[] {
  const allowed = filterAllowedPageKeys(allowedPageKeysForRole(role));
  if (!allowed) return groups;
  const allow = new Set(allowed);
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allow.has(item.key)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Identity / review surfaces that stay available while Marketplace Access is false. */
export const PARTNER_IDENTITY_PAGE_KEYS: Record<'seller' | 'creator', readonly string[]> = {
  seller: ['dashboard', 'brandProfile', 'settings', 'notifications'],
  creator: ['dashboard', 'creatorProfile', 'settings', 'notifications'],
};

export function identityPageKeysForRole(role: string | undefined | null): Set<string> {
  if (role === 'creator') return new Set(PARTNER_IDENTITY_PAGE_KEYS.creator);
  if (role === 'seller' || role === 'verified_seller') return new Set(PARTNER_IDENTITY_PAGE_KEYS.seller);
  return new Set();
}

export function pageLockedByMarketplaceAccess(params: {
  role: string | undefined | null;
  pageKey: string;
  marketplaceAccess: boolean | undefined;
}): boolean {
  const role = params.role === 'verified_seller' ? 'seller' : params.role;
  if (role !== 'seller' && role !== 'creator') return false;
  if (params.marketplaceAccess !== false) return false;
  return !identityPageKeysForRole(role).has(params.pageKey);
}

/**
 * Role allowlist first. While Marketplace Access is pending, do not hide commercial
 * modules via entitlements — annotate them LOCKED_BY_MARKETPLACE_ACCESS instead.
 * After access is granted, Feature Access entitlement hiding still applies.
 */
export function partnerNavGroupsForSession(params: {
  role: string | undefined;
  marketplaceAccess: boolean | undefined;
  filterAllowedPageKeys: (keys: string[] | null) => string[] | null;
}): CmsNavGroup[] {
  const { role, marketplaceAccess, filterAllowedPageKeys } = params;
  const base = navGroupsForRole(role);
  const pendingLock =
    (role === 'seller' || role === 'creator' || role === 'verified_seller') &&
    marketplaceAccess === false;
  const groups = pendingLock
    ? base
    : applyEntitlementNavFilter(base, filterAllowedPageKeys, role);
  if (!pendingLock) return groups;
  const identity = identityPageKeysForRole(role);
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      identity.has(item.key) ? item : { ...item, lock: 'marketplace' as const },
    ),
  }));
}

/** Iframe navDefs shape (no React paths). */
export function navGroupsForMirror(
  groups: CmsNavGroup[],
): Array<{ title: string; items: Array<{ key: string; label: string; tag?: string; lock?: NavLockReason }> }> {
  return groups.map((group) => ({
    title: group.title,
    items: group.items.map(({ key, label, tag, lock }) => ({
      key,
      label,
      ...(tag ? { tag } : {}),
      ...(lock ? { lock } : {}),
    })),
  }));
}
