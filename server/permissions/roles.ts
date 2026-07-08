export const ROLES = {
  USER: 'user',
  SELLER: 'seller',
  VERIFIED_SELLER: 'verified_seller',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  CREATOR: 'creator',
  FINANCE_MANAGER: 'finance_manager',
  SUPPORT_AGENT: 'support_agent',
  MARKETING_MANAGER: 'marketing_manager',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_VALUES = Object.values(ROLES) as UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.USER]: 'User',
  [ROLES.SELLER]: 'Seller',
  [ROLES.VERIFIED_SELLER]: 'Verified Seller',
  [ROLES.MODERATOR]: 'Moderator',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.CREATOR]: 'Creator',
  [ROLES.FINANCE_MANAGER]: 'Finance Manager',
  [ROLES.SUPPORT_AGENT]: 'Support Agent',
  [ROLES.MARKETING_MANAGER]: 'Marketing Manager',
};

export const ROLE_INHERITANCE: Record<UserRole, readonly UserRole[]> = {
  [ROLES.USER]: [ROLES.USER],
  [ROLES.SELLER]: [ROLES.SELLER, ROLES.USER],
  [ROLES.VERIFIED_SELLER]: [ROLES.VERIFIED_SELLER, ROLES.SELLER, ROLES.USER],
  [ROLES.MODERATOR]: [ROLES.MODERATOR, ROLES.USER],
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.MODERATOR, ROLES.USER],
  [ROLES.SUPER_ADMIN]: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.MODERATOR,
    ROLES.VERIFIED_SELLER,
    ROLES.SELLER,
    ROLES.CREATOR,
    ROLES.FINANCE_MANAGER,
    ROLES.SUPPORT_AGENT,
    ROLES.MARKETING_MANAGER,
    ROLES.USER,
  ],
  [ROLES.CREATOR]: [ROLES.CREATOR, ROLES.USER],
  [ROLES.FINANCE_MANAGER]: [ROLES.FINANCE_MANAGER, ROLES.USER],
  [ROLES.SUPPORT_AGENT]: [ROLES.SUPPORT_AGENT, ROLES.USER],
  [ROLES.MARKETING_MANAGER]: [ROLES.MARKETING_MANAGER, ROLES.USER],
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ROLE_VALUES.includes(value as UserRole);
}

export function toUserRole(value: unknown, fallback: UserRole = ROLES.USER): UserRole {
  return isUserRole(value) ? value : fallback;
}
