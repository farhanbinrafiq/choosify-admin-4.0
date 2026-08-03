import { ROLES, toUserRole, type UserRole } from '../permissions/roles';
import { getPermissionsForRole } from '../permissions/authorization';
import type { Permission } from '../permissions/permissions';
import { loadAdminUser, loadAdminUserByEmail } from '../operations/operationsDb';
import { verifyAccessToken, type AccessTokenClaims } from './jwtTokens';

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  permissions: readonly Permission[];
  emailVerified?: boolean;
};

export const DEV_ROLE_MAP: Record<string, UserRole> = {
  'admin@choosify.com.bd': ROLES.SUPER_ADMIN,
  'finance@choosify.com.bd': ROLES.FINANCE_MANAGER,
  'support@choosify.com.bd': ROLES.SUPPORT_AGENT,
  'marketing@choosify.com.bd': ROLES.MARKETING_MANAGER,
  'moderator@choosify.com.bd': ROLES.MODERATOR,
  'seller@choosify.com.bd': ROLES.SELLER,
  'creator@choosify.com.bd': ROLES.CREATOR,
};

export function getBearerToken(authorizationHeader: string | undefined): string {
  const header = authorizationHeader || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/** Verify a self-hosted access JWT. Replaces Firebase ID-token verification. */
export async function verifyFirebaseToken(token: string): Promise<AccessTokenClaims | null> {
  return verifyAccessToken(token);
}

export async function resolveAuthenticatedUser(
  decoded: AccessTokenClaims,
): Promise<AuthenticatedUser | null> {
  const profile =
    (await loadAdminUser(decoded.uid)) ||
    (decoded.email ? await loadAdminUserByEmail(decoded.email) : null);

  const role = profile?.role
    ? toUserRole(profile.role)
    : decoded.email
      ? DEV_ROLE_MAP[decoded.email.toLowerCase()]
      : undefined;

  // Authenticated shoppers (no staff/seller profile) are platform buyers.
  if (!role) {
    return {
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.email,
      role: ROLES.USER,
      permissions: getPermissionsForRole(ROLES.USER),
      emailVerified: decoded.emailVerified,
    };
  }

  return {
    uid: decoded.uid,
    email: profile?.email || decoded.email,
    displayName: profile?.displayName || decoded.email,
    role,
    permissions: getPermissionsForRole(role),
    emailVerified: decoded.emailVerified,
  };
}

export async function resolveAuthenticatedUserFromToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const decoded = verifyAccessToken(token);
  if (!decoded) return null;
  return resolveAuthenticatedUser(decoded);
}
