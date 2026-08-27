export type PermissionKey =
  | 'content'
  | 'users'
  | 'finance'
  | 'brand'
  | 'system'
  | 'analytics'
  /** Category & Attribute Manager (Admin-only; IS-003 §57). */
  | 'taxonomy'
  /** High-risk admin-only: server-authorized “Login As User” impersonation. */
  | 'impersonate';

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<PermissionKey, boolean>> = {
  super_admin: {
    content: true,
    users: true,
    finance: true,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: true,
    impersonate: true,
  },
  admin: {
    content: true,
    users: true,
    finance: false,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: true,
    /** Platform Admin may Login As User (server still enforces role + audit). */
    impersonate: true,
  },
  // Seller/creator: permissions aligned to their CMS-mirror filtered menus
  seller: {
    content: true,
    users: true,
    finance: true,
    brand: true,
    system: true,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  creator: {
    content: true,
    users: true,
    finance: true,
    brand: false,
    system: true,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  consumer: {
    content: false,
    users: true,
    finance: false,
    brand: false,
    system: true,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  moderator: {
    content: true,
    users: false,
    finance: false,
    brand: true,
    system: false,
    analytics: true,
    taxonomy: true,
    impersonate: false,
  },
  finance_manager: {
    content: false,
    users: false,
    finance: true,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  support_agent: {
    content: false,
    users: true,
    finance: false,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
  marketing_manager: {
    content: true,
    users: false,
    finance: false,
    brand: false,
    system: false,
    analytics: true,
    taxonomy: false,
    impersonate: false,
  },
};

const ROUTE_PERMISSION: Array<{ prefix: string; permission: PermissionKey }> = [
  { prefix: '/admin/payouts', permission: 'finance' },
  { prefix: '/admin/fee-charges', permission: 'finance' },
  { prefix: '/admin/cashbook', permission: 'finance' },
  { prefix: '/admin/coupons', permission: 'content' },
  { prefix: '/admin/products', permission: 'content' },
  { prefix: '/admin/categories', permission: 'taxonomy' },
  { prefix: '/admin/brand-posts', permission: 'content' },
  { prefix: '/admin/website-cms', permission: 'content' },
  { prefix: '/admin/cms-studio', permission: 'content' },
  { prefix: '/admin/deals-banners', permission: 'content' },
  { prefix: '/admin/reviews', permission: 'content' },
  { prefix: '/admin/community-submissions', permission: 'content' },
  { prefix: '/admin/moderation', permission: 'content' },
  { prefix: '/admin/deals', permission: 'content' },
  { prefix: '/admin/ads-deals-studio', permission: 'content' },
  { prefix: '/admin/inventory', permission: 'content' },
  { prefix: '/admin/orders', permission: 'users' },
  { prefix: '/admin/orders-overview', permission: 'users' },
  { prefix: '/admin/messages', permission: 'users' },
  { prefix: '/admin/customers', permission: 'users' },
  { prefix: '/admin/consumers', permission: 'users' },
  { prefix: '/admin/creators-hub', permission: 'users' },
  { prefix: '/admin/creator-studio', permission: 'users' },
  { prefix: '/admin/creator-profile', permission: 'users' },
  { prefix: '/admin/returns', permission: 'users' },
  { prefix: '/admin/leads', permission: 'users' },
  { prefix: '/admin/jobs', permission: 'users' },
  { prefix: '/admin/seller-offers', permission: 'users' },
  { prefix: '/admin/platform-orders', permission: 'users' },
  { prefix: '/admin/conversations', permission: 'users' },
  { prefix: '/admin/sellers', permission: 'brand' },
  { prefix: '/admin/brand-studio', permission: 'brand' },
  { prefix: '/admin/brand-profile', permission: 'brand' },
  { prefix: '/admin/brand-verification', permission: 'brand' },
  { prefix: '/admin/trust-center', permission: 'brand' },
  { prefix: '/admin/settings', permission: 'system' },
  { prefix: '/admin/admins', permission: 'system' },
  { prefix: '/admin/profile', permission: 'system' },
  { prefix: '/admin/account/profile', permission: 'system' },
  { prefix: '/admin/account/profile', permission: 'system' },
  { prefix: '/admin/account/settings', permission: 'system' },
  { prefix: '/admin/account/security', permission: 'system' },
  { prefix: '/admin/analytics', permission: 'analytics' },
  { prefix: '/admin/dashboard', permission: 'analytics' },
];

export function permissionForPath(pathname: string): PermissionKey | null {
  const normalized = pathname.split('?')[0];
  const match = ROUTE_PERMISSION.find((entry) => normalized.startsWith(entry.prefix));
  return match?.permission ?? null;
}

export function hasPermission(
  role: string | undefined,
  permission: PermissionKey,
  matrix: Record<string, Record<PermissionKey, boolean>>,
): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;
  return Boolean(matrix[role]?.[permission]);
}

export function canAccessPath(
  role: string | undefined,
  pathname: string,
  matrix: Record<string, Record<PermissionKey, boolean>>,
): boolean {
  const permission = permissionForPath(pathname);
  if (!permission) return true;
  return hasPermission(role, permission, matrix);
}
