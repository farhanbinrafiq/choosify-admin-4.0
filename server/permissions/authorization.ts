import { ROLE_INHERITANCE, type UserRole } from './roles';
import { ROLE_PERMISSIONS, type Permission } from './permissions';

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasRole(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_INHERITANCE[userRole]?.includes(requiredRole) ?? false;
}

export function hasPermission(
  userRole: UserRole | undefined,
  permission: Permission,
  permissions = userRole ? getPermissionsForRole(userRole) : [],
): boolean {
  if (!userRole) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(
  userRole: UserRole | undefined,
  requiredPermissions: readonly Permission[],
  permissions = userRole ? getPermissionsForRole(userRole) : [],
): boolean {
  if (!userRole) return false;
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function hasAllPermissions(
  userRole: UserRole | undefined,
  requiredPermissions: readonly Permission[],
  permissions = userRole ? getPermissionsForRole(userRole) : [],
): boolean {
  if (!userRole) return false;
  return requiredPermissions.every((permission) => permissions.includes(permission));
}
