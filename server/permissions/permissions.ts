import { ROLES, type UserRole } from './roles';

export const PERMISSIONS = {
  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',
  SELLER_APPROVE: 'seller:approve',
  SELLER_SUSPEND: 'seller:suspend',
  USER_MANAGE: 'user:manage',
  CMS_EDIT: 'cms:edit',
  /**
   * Website Studio: publish / roll back website documents (makes them public). Deliberately NOT
   * implied by cms:edit and not granted to any role below — only SUPER_ADMIN holds it (via
   * PERMISSION_VALUES). Editors with cms:edit can save drafts and request preview only.
   */
  CMS_PUBLISH: 'cms:publish',
  /** Website Studio: publish / roll back LEGAL documents (Terms, Privacy). Super Admin only. */
  CMS_LEGAL_PUBLISH: 'cms:legal_publish',
  /** Admin-only category tree mutation (IS-003 §52). */
  CATEGORY_MANAGE: 'category.manage',
  /** Admin-only attribute/variant schema mutation (IS-003 §52). */
  ATTRIBUTE_MANAGE: 'attribute.manage',
  ANALYTICS_VIEW: 'analytics:view',
  ROLE_MANAGE: 'role:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_VALUES = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [ROLES.USER]: [PERMISSIONS.PRODUCT_READ],
  [ROLES.SELLER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.VERIFIED_SELLER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.SELLER_APPROVE,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.ATTRIBUTE_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.SELLER_APPROVE,
    PERMISSIONS.SELLER_SUSPEND,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.ATTRIBUTE_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.SUPER_ADMIN]: PERMISSION_VALUES,
  [ROLES.CREATOR]: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.FINANCE_MANAGER]: [PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.SUPPORT_AGENT]: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.ANALYTICS_VIEW],
  [ROLES.MARKETING_MANAGER]: [
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.CMS_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_VALUES.includes(value as Permission);
}
