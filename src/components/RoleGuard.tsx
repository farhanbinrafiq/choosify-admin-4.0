import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRbac } from '../contexts/RbacContext';

export const RoleGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { canAccessPath } = useRbac();

  if (location.pathname.startsWith('/admin') && !canAccessPath(location.pathname)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};
