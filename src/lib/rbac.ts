export type PermissionKey = 'content' | 'users' | 'finance' | 'brand' | 'system' | 'analytics';

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<PermissionKey, boolean>> = {
  super_admin: { content: true, users: true, finance: true, brand: true, system: true, analytics: true },
  admin: { content: true, users: true, finance: false, brand: true, system: true, analytics: true },
  seller: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
  creator: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
  moderator: { content: true, users: false, finance: false, brand: true, system: false, analytics: true },
  finance_manager: { content: false, users: false, finance: true, brand: false, system: false, analytics: true },
  support_agent: { content: false, users: true, finance: false, brand: false, system: false, analytics: true },
  marketing_manager: { content: true, users: false, finance: false, brand: false, system: false, analytics: true },
};

const ROUTE_PERMISSION: Array<{ prefix: string; permission: PermissionKey }> = [
  { prefix: '/admin/payouts', permission: 'finance' },
  { prefix: '/admin/cashbook', permission: 'finance' },
  { prefix: '/admin/coupons', permission: 'content' },
  { prefix: '/admin/products', permission: 'content' },
  { prefix: '/admin/categories', permission: 'content' },
  { prefix: '/admin/brand-posts', permission: 'content' },
  { prefix: '/admin/website-cms', permission: 'content' },
  { prefix: '/admin/cms-studio', permission: 'content' },
  { prefix: '/admin/reviews', permission: 'content' },
  { prefix: '/admin/community-submissions', permission: 'content' },
  { prefix: '/admin/moderation', permission: 'content' },
  { prefix: '/admin/deals', permission: 'content' },
  { prefix: '/admin/inventory', permission: 'content' },
  { prefix: '/admin/orders', permission: 'users' },
  { prefix: '/admin/orders-overview', permission: 'users' },
  { prefix: '/admin/messages', permission: 'users' },
  { prefix: '/admin/consumers', permission: 'users' },
  { prefix: '/admin/returns', permission: 'users' },
  { prefix: '/admin/leads', permission: 'users' },
  { prefix: '/admin/seller-offers', permission: 'users' },
  { prefix: '/admin/platform-orders', permission: 'users' },
  { prefix: '/admin/sellers', permission: 'brand' },
  { prefix: '/admin/brand-verification', permission: 'brand' },
  { prefix: '/admin/trust-center', permission: 'brand' },
  { prefix: '/admin/settings', permission: 'system' },
  { prefix: '/admin/admins', permission: 'system' },
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
