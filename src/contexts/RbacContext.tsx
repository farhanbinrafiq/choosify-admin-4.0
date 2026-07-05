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

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, Record<PermissionKey, boolean>>>(() => {
    const saved = localStorage.getItem('choosify_role_permissions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_ROLE_PERMISSIONS;
      }
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });

  const refreshPermissions = async () => {
    try {
      const remote = await operationsApi.getPermissions();
      setPermissions(remote);
      localStorage.setItem('choosify_role_permissions', JSON.stringify(remote));
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
