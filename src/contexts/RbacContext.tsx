import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ROLE_PERMISSIONS, canAccessPath, hasPermission, type PermissionKey } from '../lib/rbac';
import { operationsApi } from '../services/operationsApi';
import { useAuth } from './AuthContext';

interface RbacContextType {
  permissions: Record<string, Record<PermissionKey, boolean>>;
  can: (permission: PermissionKey) => boolean;
  canAccessPath: (pathname: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

type PermissionsMap = Record<string, Record<PermissionKey, boolean>>;

/** Keep seller/creator mirror routes usable even if API/localStorage still has legacy false flags. */
function normalizePermissions(incoming: PermissionsMap | null | undefined): PermissionsMap {
  const base = structuredClone(DEFAULT_ROLE_PERMISSIONS) as PermissionsMap;
  if (!incoming) return base;
  const merged: PermissionsMap = { ...base, ...incoming };
  for (const role of ['seller', 'creator'] as const) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role];
    merged[role] = { ...defaults, ...(incoming[role] || {}) };
    (Object.keys(defaults) as PermissionKey[]).forEach((key) => {
      if (defaults[key]) merged[role][key] = true;
    });
  }
  return merged;
}

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>(() => {
    const saved = localStorage.getItem('choosify_role_permissions');
    if (saved) {
      try {
        return normalizePermissions(JSON.parse(saved));
      } catch {
        return normalizePermissions(null);
      }
    }
    return normalizePermissions(null);
  });

  const refreshPermissions = async () => {
    try {
      const remote = await operationsApi.getPermissions();
      const normalized = normalizePermissions(remote);
      setPermissions(normalized);
      localStorage.setItem('choosify_role_permissions', JSON.stringify(normalized));
    } catch {
      // Keep local matrix when API unavailable
    }
  };

  useEffect(() => {
    refreshPermissions();
  }, []);

  const value = useMemo<RbacContextType>(
    () => ({
      permissions,
      can: (permission) => hasPermission(profile?.role, permission, permissions),
      canAccessPath: (pathname) => canAccessPath(profile?.role, pathname, permissions),
      refreshPermissions,
    }),
    [permissions, profile?.role],
  );

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
};

export const useRbac = () => {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error('useRbac must be used within RbacProvider');
  }
  return context;
};
