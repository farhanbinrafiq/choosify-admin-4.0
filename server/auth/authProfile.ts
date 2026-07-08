import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, hasFirebaseAdminCredentials } from '../firebaseAdmin';
import { loadAdminUser, loadAdminUserByEmail } from '../operations/operationsFirestore';
import { ROLES, toUserRole, type UserRole } from '../permissions/roles';
import { getPermissionsForRole } from '../permissions/authorization';
import type { Permission } from '../permissions/permissions';

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

export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken | null> {
  if (!hasFirebaseAdminCredentials()) return null;

  const auth = await getAdminAuth();
  if (!auth) return null;

  return auth.verifyIdToken(token);
}

export async function resolveAuthenticatedUser(
  decoded: DecodedIdToken,
): Promise<AuthenticatedUser | null> {
  const profile =
    (await loadAdminUser(decoded.uid)) ||
    (decoded.email ? await loadAdminUserByEmail(decoded.email) : null);

  const role = profile?.role
    ? toUserRole(profile.role)
    : decoded.email
      ? DEV_ROLE_MAP[decoded.email.toLowerCase()]
      : undefined;

  if (!role) return null;

  return {
    uid: decoded.uid,
    email: profile?.email || decoded.email,
    displayName: profile?.displayName || decoded.name || decoded.email,
    role,
    permissions: getPermissionsForRole(role),
    emailVerified: decoded.email_verified,
  };
}

export async function resolveAuthenticatedUserFromToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) return null;
  return resolveAuthenticatedUser(decoded);
}
