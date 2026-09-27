/**
 * Partner (Seller/Creator) feature entitlement catalog.
 * Admin RBAC modules are intentionally excluded — this controls commercial partner access only.
 *
 * Phase 1 (enforcement integrity) metadata:
 * - tier: 'core' capabilities can never be switched off by role, plan or account
 *   state (the resolver short-circuits them to enabled). 'operational' features are
 *   switchable administratively but are NOT plan-controlled. 'premium' features are
 *   plan-controlled candidates. 'reserved' keys hold a name for a capability that is
 *   not built yet — they gate no API.
 * - planControlled: only these keys honor plan_entitlements rows. A plan (or plan
 *   expiry) can never remove a non-plan-controlled capability.
 * - deprecated: kept for history (existing DB rows, audit trails); never resolved,
 *   never switchable, never shown as an active toggle.
 */

export type PartnerRole = 'seller' | 'creator';

export type PartnerFeatureKey =
  | 'cashbooks'
  | 'messaging'
  | 'metaMessaging'
  | 'analytics'
  | 'advancedAnalytics'
  | 'logisticsAnalytics'
  | 'customerInsights'
  | 'adsDeals'
  | 'promotionRequests'
  | 'guideManagement'
  | 'promoCodes'
  | 'returnsRefunds'
  | 'logistics'
  | 'myEarnings'
  | 'payouts'
  | 'feesAdjustments'
  | 'products'
  | 'brandStudio'
  | 'reviews'
  | 'notifications';

export type PartnerFeatureTier = 'core' | 'operational' | 'premium' | 'reserved';

export type PartnerFeatureGroup =
  | 'storefront'
  | 'finance'
  | 'marketing'
  | 'messaging'
  | 'operations'
  | 'insights'
  | 'account';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Display order + titles for Feature Access groups (catalog-driven, not page-local). */
export const PARTNER_FEATURE_GROUPS: { key: PartnerFeatureGroup; title: string }[] = [
  { key: 'storefront', title: 'Storefront & Catalog' },
  { key: 'marketing', title: 'Marketing & Promotion' },
  { key: 'messaging', title: 'Messaging' },
  { key: 'operations', title: 'Operations & Fulfilment' },
  { key: 'insights', title: 'Insights & Analytics' },
  { key: 'finance', title: 'Finance & Earnings' },
  { key: 'account', title: 'Account' },
];

export type PartnerFeatureDef = {
  key: PartnerFeatureKey;
  label: string;
  description: string;
  /** CMS-mirror / workspace page keys gated by this feature */
  pageKeys: string[];
  /**
   * API path prefixes (matched against originalUrl). Matching is on whole path
   * segments: '/api/messaging' matches '/api/messaging' and '/api/messaging/x',
   * never '/api/messaging-anything'.
   */
  apiPrefixes: string[];
  /**
   * Mid-path route patterns. Same segment semantics as apiPrefixes, plus ':name'
   * segments that match exactly one non-empty path segment
   * (e.g. '/api/v1/ads/deals/:id/promotion-requests').
   */
  apiPatterns?: string[];
  /**
   * When set, only these HTTP methods are entitlement-gated for apiPrefixes/apiPatterns.
   * Use for catalog surfaces that also serve public storefront GETs, and for
   * premium surfaces that stay readable (read-only) after an entitlement lapses.
   */
  apiMethods?: HttpMethod[];
  /** Which partner roles this feature applies to */
  roles: PartnerRole[];
  tier: PartnerFeatureTier;
  /** True only for keys a Plan may grant/withhold (premium candidates). */
  planControlled: boolean;
  group: PartnerFeatureGroup;
  deprecated?: { replacedBy?: PartnerFeatureKey; reason: string };
};

const WRITE_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const PARTNER_FEATURES: PartnerFeatureDef[] = [
  {
    key: 'cashbooks',
    label: 'Cashbooks',
    description: 'Personal cashbook ledgers and order import',
    pageKeys: ['myCashbook'],
    apiPrefixes: ['/api/v1/cashbooks'],
    roles: ['seller', 'creator'],
    tier: 'operational',
    planControlled: false,
    group: 'finance',
  },
  {
    key: 'messaging',
    label: 'Messaging',
    description: 'Buyer conversations inbox (Choosify Support is always available)',
    // 'sellerConversations' is the seller sidebar inbox; 'messages' is kept for
    // legacy partner routes. Creator 'partnerSupport' (Choosify Support) is core
    // and deliberately NOT listed here.
    pageKeys: ['messages', 'sellerConversations'],
    // The staff-only messaging hub (/api/conversations, /api/messages) is not a
    // partner surface and is no longer mapped here.
    apiPrefixes: ['/api/v1/conversations', '/api/v1/operations/platform-messages'],
    roles: ['seller', 'creator'],
    tier: 'operational',
    planControlled: false,
    group: 'messaging',
  },
  {
    key: 'metaMessaging',
    label: 'Meta Messaging',
    description: 'Meta / social inbox channels',
    pageKeys: [],
    // '/api/messaging' (staff hub + public status probe) removed — dead mapping.
    apiPrefixes: ['/api/v1/seller/social-inbox'],
    roles: ['seller', 'creator'],
    tier: 'premium',
    planControlled: true,
    group: 'messaging',
  },
  {
    key: 'analytics',
    label: 'Finance Summary',
    description: 'Earnings and balance summary — financial visibility is always available',
    pageKeys: ['finance'],
    apiPrefixes: ['/api/v1/finance/summary', '/api/v1/finance/adjustments'],
    roles: ['seller', 'creator'],
    tier: 'core',
    planControlled: false,
    group: 'finance',
  },
  {
    key: 'advancedAnalytics',
    label: 'Advanced Analytics (deprecated)',
    description: 'Historical key — courier analytics is now logisticsAnalytics',
    // Previously pageKeys ['courierAnalytics'] + apiPrefixes ['/api/v1/logistics/analytics']
    // (a prefix that never matched any route). Kept for history only.
    pageKeys: [],
    apiPrefixes: [],
    roles: ['seller'],
    tier: 'premium',
    planControlled: false,
    group: 'insights',
    deprecated: {
      replacedBy: 'logisticsAnalytics',
      reason: 'Only courier analytics existed under this key; re-keyed to logisticsAnalytics.',
    },
  },
  {
    key: 'logisticsAnalytics',
    label: 'Logistics Analytics',
    description: 'Courier delivery performance analytics (page-level)',
    // Courier Analytics computes from GET /operations/shipments (core order
    // fulfilment), so it is gated at page level only — no dedicated API exists.
    pageKeys: ['courierAnalytics'],
    apiPrefixes: [],
    roles: ['seller'],
    tier: 'premium',
    planControlled: true,
    group: 'insights',
  },
  {
    key: 'customerInsights',
    label: 'Customer / User Behaviour Insights',
    description: 'My Customers buyer segments and history',
    pageKeys: ['sellerCustomers'],
    // '/api/v1/operations/my-customers' removed — no such route exists (dead mapping).
    apiPrefixes: ['/api/v1/catalog/workspace/seller/customers', '/api/v1/catalog/workspace/creator/customers'],
    roles: ['seller', 'creator'],
    tier: 'premium',
    planControlled: true,
    group: 'insights',
  },
  {
    key: 'adsDeals',
    label: 'Ads & Deals tools',
    description: 'Ads & Deals Studio and visual builder',
    pageKeys: ['adsDealsStudio'],
    apiPrefixes: ['/api/v1/ads'],
    roles: ['seller', 'creator'],
    tier: 'operational',
    planControlled: false,
    group: 'marketing',
  },
  {
    key: 'promotionRequests',
    label: 'Promotion Requests',
    description: 'Request admin-reviewed storefront promotion for a Deal',
    pageKeys: [],
    apiPrefixes: [],
    apiPatterns: ['/api/v1/ads/deals/:id/promotion-requests', '/api/v1/ads/promotion-requests'],
    // Existing requests stay readable after the entitlement lapses; no new
    // requests (or changes) without it.
    apiMethods: WRITE_METHODS,
    roles: ['seller', 'creator'],
    tier: 'premium',
    planControlled: true,
    group: 'marketing',
  },
  {
    key: 'guideManagement',
    label: 'Guide Management',
    description: 'Creator/seller guide content studio',
    pageKeys: ['contentStudio'],
    apiPrefixes: ['/api/v1/catalog/guides'],
    apiPatterns: ['/api/v1/catalog/guide/:id/draft', '/api/v1/catalog/guide/:id/versions'],
    apiMethods: WRITE_METHODS,
    roles: ['seller', 'creator'],
    tier: 'operational',
    planControlled: false,
    group: 'marketing',
  },
  {
    key: 'promoCodes',
    label: 'Promo Codes & Vouchers',
    description: 'Seller promo code management',
    pageKeys: ['promoCodes'],
    apiPrefixes: ['/api/v1/operations/coupons'],
    apiMethods: WRITE_METHODS,
    roles: ['seller'],
    tier: 'operational',
    planControlled: false,
    group: 'marketing',
  },
  {
    key: 'returnsRefunds',
    label: 'Returns & Refunds',
    description: 'Returns console (administrative restriction only — never plan-controlled)',
    pageKeys: ['returnsRefunds'],
    apiPrefixes: ['/api/v1/operations/returns'],
    roles: ['seller'],
    tier: 'operational',
    planControlled: false,
    group: 'operations',
  },
  {
    key: 'logistics',
    label: 'Courier Integrations',
    description: 'Reserved for future courier provider integrations (not yet available)',
    // Shipment operations (/operations/shipments) are CORE order fulfilment and
    // are intentionally not gated by this key. No courier API exists yet.
    pageKeys: ['courierProviders'],
    apiPrefixes: [],
    roles: ['seller'],
    tier: 'reserved',
    planControlled: false,
    group: 'operations',
  },
  {
    key: 'myEarnings',
    label: 'My Earnings',
    description: 'Earnings overview — financial visibility is always available',
    pageKeys: ['myEarnings'],
    apiPrefixes: [],
    roles: ['seller', 'creator'],
    tier: 'core',
    planControlled: false,
    group: 'finance',
  },
  {
    key: 'payouts',
    label: 'Payouts',
    description: 'Payout balance visibility — always available',
    pageKeys: ['payouts'],
    // '/api/v1/operations/payouts' never existed; withdrawal requests are not built.
    apiPrefixes: [],
    roles: ['seller', 'creator'],
    tier: 'core',
    planControlled: false,
    group: 'finance',
  },
  {
    key: 'feesAdjustments',
    label: 'Fees & Adjustments',
    description: 'Fee and adjustment transparency — always available',
    pageKeys: ['feesAdjustments'],
    apiPrefixes: ['/api/v1/finance/adjustments'],
    roles: ['seller', 'creator'],
    tier: 'core',
    planControlled: false,
    group: 'finance',
  },
  {
    key: 'products',
    label: 'Products & Inventory',
    description: 'Catalog products and inventory',
    pageKeys: ['products'],
    apiPrefixes: ['/api/v1/catalog/products', '/api/v1/catalog/services', '/api/v1/catalog/product-details'],
    // Draft entity types are brand | product | creator | guide — services have no
    // draft entity of their own.
    apiPatterns: ['/api/v1/catalog/product/:id/draft', '/api/v1/catalog/product/:id/versions'],
    apiMethods: WRITE_METHODS,
    roles: ['seller'],
    tier: 'operational',
    planControlled: false,
    group: 'storefront',
  },
  {
    key: 'brandStudio',
    label: 'Brand Management Studio',
    description: 'Seller brand studio',
    pageKeys: ['brands'],
    apiPrefixes: ['/api/v1/catalog/brands'],
    apiPatterns: ['/api/v1/catalog/brand/:id/draft', '/api/v1/catalog/brand/:id/versions'],
    apiMethods: WRITE_METHODS,
    roles: ['seller'],
    tier: 'operational',
    planControlled: false,
    group: 'storefront',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    description: 'Review moderation for own listings',
    pageKeys: ['reviews'],
    apiPrefixes: ['/api/v1/operations/reviews'],
    apiMethods: WRITE_METHODS,
    roles: ['seller', 'creator'],
    tier: 'operational',
    planControlled: false,
    group: 'storefront',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Notification center and preferences — core, includes mandatory account/security notices',
    pageKeys: ['notifications'],
    apiPrefixes: ['/api/notifications'],
    roles: ['seller', 'creator'],
    tier: 'core',
    planControlled: false,
    group: 'account',
  },
];

/**
 * Partner API surfaces that are CORE and have no feature key: they must never be
 * matched by any entitlement mapping. Asserted by scripts/probe-entitlement-phase1.ts.
 */
export const CORE_PARTNER_API_ROUTES: string[] = [
  '/api/v1/operations/orders',
  '/api/v1/operations/shipments',
  '/api/v1/operations/manual-offers',
  '/api/v1/operations/warranty-claims',
  '/api/v1/operations/disputes',
  '/api/v1/operations/verifications',
  '/api/v1/operations/seller-dashboard',
  '/api/v1/support',
  '/api/v1/auth',
  '/api/v1/entitlements',
];

export function featureByKey(key: string): PartnerFeatureDef | undefined {
  return PARTNER_FEATURES.find((f) => f.key === key);
}

/** Active (non-deprecated) feature keys for a role. */
export function featureKeysForRole(role: PartnerRole): PartnerFeatureKey[] {
  return PARTNER_FEATURES.filter((f) => f.roles.includes(role) && !f.deprecated).map((f) => f.key);
}

export function isCoreFeature(feature: PartnerFeatureDef | undefined): boolean {
  return feature?.tier === 'core';
}

/** Whether an admin role/account switch may change this key. */
export function isSwitchableFeature(feature: PartnerFeatureDef | undefined): boolean {
  if (!feature || feature.deprecated) return false;
  return feature.tier === 'operational' || feature.tier === 'premium';
}

export function switchableFeatureKeysForRole(role: PartnerRole): PartnerFeatureKey[] {
  return PARTNER_FEATURES.filter((f) => f.roles.includes(role) && isSwitchableFeature(f)).map((f) => f.key);
}

function normalizeApiPath(path: string): string {
  const withoutQuery = String(path || '').split('?')[0].split('#')[0];
  // Express routing is case-insensitive by default, so matching must be too.
  return withoutQuery.toLowerCase();
}

/**
 * Segment-boundary route match. `route` matches `path` when every route segment
 * equals the corresponding path segment (':name' matches any one non-empty
 * segment); extra trailing path segments are allowed (nested resources).
 */
export function apiRouteMatches(path: string, route: string): boolean {
  const pathSegs = normalizeApiPath(path).split('/');
  const routeSegs = route.toLowerCase().split('/');
  if (routeSegs.length > pathSegs.length) return false;
  for (let i = 0; i < routeSegs.length; i += 1) {
    const r = routeSegs[i];
    const p = pathSegs[i];
    if (r.startsWith(':')) {
      if (!p) return false;
      continue;
    }
    if (r !== p) return false;
  }
  return true;
}

/** Non-deprecated features for `role` whose API mapping covers this request. */
export function featuresForApiRequest(role: PartnerRole, path: string, method = 'GET'): PartnerFeatureDef[] {
  const m = String(method || 'GET').toUpperCase();
  return PARTNER_FEATURES.filter((feature) => {
    if (feature.deprecated || !feature.roles.includes(role)) return false;
    if (feature.apiMethods?.length && !feature.apiMethods.includes(m as HttpMethod)) return false;
    const routes = [...feature.apiPrefixes, ...(feature.apiPatterns || [])];
    return routes.some((route) => apiRouteMatches(path, route));
  });
}

/** True when this page key is gated by a switchable catalog feature for the role. */
export function isEntitlementControlledPageKey(role: PartnerRole, pageKey: string): boolean {
  return PARTNER_FEATURES.some(
    (f) => f.roles.includes(role) && !isCoreFeature(f) && !f.deprecated && f.pageKeys.includes(pageKey),
  );
}

/** Switchable, non-deprecated features that gate `pageKey` for `role`. */
export function featuresForPageKey(role: PartnerRole, pageKey: string): PartnerFeatureDef[] {
  return PARTNER_FEATURES.filter(
    (f) => f.roles.includes(role) && !isCoreFeature(f) && !f.deprecated && f.pageKeys.includes(pageKey),
  );
}

export function pageKeysDisabledByFeatures(
  role: PartnerRole,
  enabled: Record<string, boolean>,
): Set<string> {
  const disabled = new Set<string>();
  for (const feature of PARTNER_FEATURES) {
    if (!feature.roles.includes(role)) continue;
    // Core pages are never hidden; deprecated keys gate nothing.
    if (isCoreFeature(feature) || feature.deprecated) continue;
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
