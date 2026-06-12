import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'super_admin' | 'seller' | 'creator' | 'moderator' | 'finance_manager' | 'support_agent' | 'marketing_manager';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: any | null; // Keep for compatibility
  profile: UserProfile | null;
  loading: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const mockProfiles: Record<UserRole, UserProfile> = {
  super_admin: {
    id: 'admin_001',
    displayName: 'Abdur Rahman',
    email: 'ar@choosify.com.bd',
    role: 'super_admin',
  },
  seller: {
    id: 'seller_001',
    displayName: 'Rahim Uddin',
    email: 'rahim@aarong.com',
    role: 'seller',
  },
  creator: {
    id: 'creator_001',
    displayName: 'Sumaiya Akter',
    email: 'sumaiya@creators.bd',
    role: 'creator',
  },
  moderator: {
    id: 'mod_001',
    displayName: 'Afsana Mimi',
    email: 'afsana@choosify.com.bd',
    role: 'moderator',
  },
  finance_manager: {
    id: 'fin_001',
    displayName: 'Sajid Islam',
    email: 'sajid@choosify.com.bd',
    role: 'finance_manager',
  },
  support_agent: {
    id: 'sup_001',
    displayName: 'Kazi Farhan',
    email: 'kazi@choosify.com.bd',
    role: 'support_agent',
  },
  marketing_manager: {
    id: 'mkt_001',
    displayName: 'Nusrat Jahan',
    email: 'nusrat@choosify.com.bd',
    role: 'marketing_manager',
  },
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  login: () => {},
  logout: () => {},
  switchRole: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from local storage if exists
    const savedRole = localStorage.getItem('choosify_mock_role') as UserRole;
    if (savedRole && mockProfiles[savedRole]) {
      setProfile(mockProfiles[savedRole]);
    }
    setLoading(false);
  }, []);

  const login = (role: UserRole) => {
    setProfile(mockProfiles[role]);
    localStorage.setItem('choosify_mock_role', role);
  };

  const logout = () => {
    setProfile(null);
    localStorage.removeItem('choosify_mock_role');
  };

  const switchRole = (role: UserRole) => {
    setProfile(mockProfiles[role]);
    localStorage.setItem('choosify_mock_role', role);
  };

  return (
    <AuthContext.Provider value={{ 
      user: profile ? { uid: profile.id, email: profile.email } : null, 
      profile, 
      loading,
      login,
      logout,
      switchRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};
