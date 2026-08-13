import type { UserProfile, UserRole } from '../contexts/AuthContext';

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  seller: 'Seller',
  creator: 'Creator',
  consumer: 'Consumer',
  moderator: 'Moderator',
  finance_manager: 'Finance Manager',
  support_agent: 'Support Agent',
  marketing_manager: 'Marketing Manager',
};

export function formatRoleLabel(role: UserRole | string | undefined): string {
  if (!role) return 'User';
  return ROLE_LABELS[role as UserRole] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getUserInitials(displayName: string, email: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email.trim()[0] || 'U').toUpperCase();
}

export function getAvatarUrl(profile: Pick<UserProfile, 'displayName' | 'email' | 'avatar'>): string {
  if (profile.avatar?.trim()) return profile.avatar.trim();
  const label = profile.displayName?.trim() || profile.email?.trim() || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=FF5B00&color=ffffff&bold=true&size=128`;
}

/**
 * Canonical own-profile destination for the authenticated effective session user.
 *
 * Live self-profiles use the approved cms-mirror profile chrome (Image 1):
 * Seller → /admin/brand-profile, Creator → /admin/creator-profile,
 * Admin → /admin/profile, Consumer → /admin/consumer-profile.
 *
 * React UnifiedProfileShell (/seller|:id, /upe/…) remains Admin inspection / legacy only —
 * not Avatar → My Profile or sidebar self-profile entry points.
 */
export function getMyProfilePath(profile: Pick<UserProfile, 'id' | 'role'>): string {
  switch (profile.role) {
    case 'seller':
      return '/admin/brand-profile';
    case 'creator':
      return '/admin/creator-profile';
    case 'consumer':
      return '/admin/consumer-profile';
    default:
      return '/admin/profile';
  }
}

/** @deprecated Prefer getMyProfilePath — kept as an explicit alias for call sites. */
export function resolveOwnProfileRoute(
  profile: Pick<UserProfile, 'id' | 'role'> | null | undefined,
): string {
  if (!profile) return '/admin/profile';
  return getMyProfilePath(profile);
}

/** Authoritative Settings destination — same as left-nav Settings for every role. */
export function getSettingsPath(): string {
  return '/admin/settings';
}
