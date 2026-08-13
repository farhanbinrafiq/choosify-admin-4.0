/**
 * Partner (Seller/Creator) feature entitlement catalog.
 * Admin RBAC modules are intentionally excluded — this controls commercial partner access only.
 */

export type PartnerRole = 'seller' | 'creator';

export type PartnerFeatureKey =
  | 'cashbooks'
  | 'messaging'
  | 'metaMessaging'
  | 'analytics'
  | 'advancedAnalytics'
  | 'customerInsights'
  | 'adsDeals'
  | 'guideManagement'
  | 'promoCodes'
  | 'returnsRefunds'
  | 'logistics'
  | 'creatorEconomy'
  | 'myEarnings'
  | 'payouts'
  | 'feesAdjustments'
  | 'products'
  | 'brandStudio'
  | 'reviews'
  | 'notifications';

export type PartnerFeatureDef = {
  key: PartnerFeatureKey;
  label: string;
  description: string;
  /** CMS-mirror / workspace page keys gated by this feature */
  pageKeys: string[];
  /** API path prefixes (matched against originalUrl) */
  apiPrefixes: string[];
  /**
   * When set, only these HTTP methods are entitlement-gated for apiPrefixes.
   * Use for catalog surfaces that also serve public storefront GETs.
   */
  apiMethods?: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  /** Which partner roles this feature applies to */
  roles: PartnerRole[];
};

export const PARTNER_FEATURES: PartnerFeatureDef[] = [
  {
    key: 'cashbooks',
    label: 'Cashbooks',
    description: 'Personal cashbook ledgers and order import',
    pageKeys: ['myCashbook'],
    apiPrefixes: ['/api/v1/cashbooks'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    description: 'Choosify inbox / commerce conversations',
    pageKeys: ['messages'],
    apiPrefixes: ['/api/v1/conversations', '/api/conversations', '/api/messages'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'metaMessaging',
    label: 'Meta Messaging',
    description: 'Meta / social inbox channels',
    pageKeys: [],
    apiPrefixes: ['/api/messaging', '/api/v1/seller/social-inbox'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Finance & Payouts analytics overview',
    pageKeys: ['finance'],
    apiPrefixes: ['/api/v1/finance/summary', '/api/v1/finance/adjustments'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'advancedAnalytics',
    label: 'Advanced Analytics',
    description: 'Courier / logistics analytics',
    pageKeys: ['courierAnalytics'],
    apiPrefixes: ['/api/v1/logistics/analytics'],
    roles: ['seller'],
  },
  {
    key: 'customerInsights',
    label: 'Customer / User Behaviour Insights',
    description: 'My Customers buyer segments and history',
    pageKeys: ['sellerCustomers'],
    apiPrefixes: [
      '/api/v1/operations/my-customers',
      '/api/v1/catalog/workspace/seller/customers',
      '/api/v1/catalog/workspace/creator/customers',
    ],
    roles: ['seller', 'creator'],
  },
  {
    key: 'adsDeals',
    label: 'Ads & Deals tools',
    description: 'Ads & Deals Studio and visual builder',
    pageKeys: ['adsDealsStudio'],
    apiPrefixes: ['/api/v1/ads'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'guideManagement',
    label: 'Guide Management',
    description: 'Creator/seller guide content studio',
    pageKeys: ['contentStudio'],
    apiPrefixes: ['/api/v1/catalog/guides'],
    apiMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'promoCodes',
    label: 'Promo Codes & Vouchers',
    description: 'Seller promo code management',
    pageKeys: ['promoCodes'],
    apiPrefixes: ['/api/v1/operations/coupons'],
    apiMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    roles: ['seller'],
  },
  {
    key: 'returnsRefunds',
    label: 'Returns & Refunds',
    description: 'Returns console',
    pageKeys: ['returnsRefunds'],
    apiPrefixes: ['/api/v1/operations/returns'],
    roles: ['seller'],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    description: 'Courier providers and shipment operations',
    pageKeys: ['courierProviders', 'shipmentOperations'],
    apiPrefixes: ['/api/v1/logistics', '/api/logistics'],
    roles: ['seller'],
  },
  {
    key: 'creatorEconomy',
    label: 'Creator Economy',
    description: 'Creator economy hub',
    pageKeys: ['creatorEconomy'],
    apiPrefixes: [],
    roles: ['creator'],
  },
  {
    key: 'myEarnings',
    label: 'My Earnings',
    description: 'Earnings overview and payment info',
    pageKeys: ['myEarnings'],
    apiPrefixes: [],
    roles: ['seller', 'creator'],
  },
  {
    key: 'payouts',
    label: 'Payouts / Withdrawals',
    description: 'Payout request surfaces',
    pageKeys: ['payouts'],
    apiPrefixes: ['/api/v1/operations/payouts'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'feesAdjustments',
    label: 'Fees & Adjustments',
    description: 'Fee and adjustment views',
    pageKeys: ['feesAdjustments'],
    apiPrefixes: ['/api/v1/finance/adjustments'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'products',
    label: 'Products & Inventory',
    description: 'Catalog products and inventory',
    pageKeys: ['products'],
    apiPrefixes: ['/api/v1/catalog/products', '/api/v1/catalog/services'],
    apiMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    roles: ['seller'],
  },
  {
    key: 'brandStudio',
    label: 'Brand Management Studio',
    description: 'Seller brand studio',
    pageKeys: ['brands'],
    apiPrefixes: ['/api/v1/catalog/brands'],
    apiMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    roles: ['seller'],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    description: 'Review moderation for own listings',
    pageKeys: ['reviews'],
    apiPrefixes: ['/api/v1/operations/reviews'],
    apiMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    roles: ['seller', 'creator'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Notification center',
    pageKeys: ['notifications'],
    apiPrefixes: ['/api/notifications'],
    roles: ['seller', 'creator'],
  },
];

export function featureByKey(key: string): PartnerFeatureDef | undefined {
  return PARTNER_FEATURES.find((f) => f.key === key);
}

export function featureKeysForRole(role: PartnerRole): PartnerFeatureKey[] {
  return PARTNER_FEATURES.filter((f) => f.roles.includes(role)).map((f) => f.key);
}

/** True when this page key is gated by a catalog feature for the role. */
export function isEntitlementControlledPageKey(role: PartnerRole, pageKey: string): boolean {
  return PARTNER_FEATURES.some((f) => f.roles.includes(role) && f.pageKeys.includes(pageKey));
}

export function pageKeysDisabledByFeatures(
  role: PartnerRole,
  enabled: Record<string, boolean>,
): Set<string> {
  const disabled = new Set<string>();
  for (const feature of PARTNER_FEATURES) {
    if (!feature.roles.includes(role)) continue;
    if (enabled[feature.key] === false) {
      for (const pageKey of feature.pageKeys) disabled.add(pageKey);
    }
  }
  return disabled;
}

export function defaultRoleEntitlements(role: PartnerRole): Record<PartnerFeatureKey, boolean> {
  const out = {} as Record<PartnerFeatureKey, boolean>;
  for (const key of featureKeysForRole(role)) out[key] = true;
  return out;
}
