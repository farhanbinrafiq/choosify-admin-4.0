import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'seller' 
  | 'creator' 
  | 'moderator' 
  | 'finance_manager' 
  | 'support_agent' 
  | 'marketing_manager';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface SellerBrandRelation {
  id: string;
  seller_user_id: string;
  brand_id: string;
  role: string;
  created_at: string;
}

export interface BrandCMSModel {
  id: string;
  brandName: string;
  category: string;
}

interface AuthContextType {
  user: any | null; // Keep for compatibility
  profile: UserProfile | null;
  loading: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  // Brand Switching Context API for multi-brand sellers
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  sellerBrands: SellerBrandRelation[];
  allBrands: { id: string; name: string; category: string }[];
  requestNewBrand: (name: string, category: string) => void;
}

const mockProfiles: Record<UserRole, UserProfile> = {
  super_admin: {
    id: 'admin_001',
    displayName: 'Abdur Rahman',
    email: 'ar@choosify.com.bd',
    role: 'super_admin',
  },
  admin: {
    id: 'admin_002',
    displayName: 'Tanvir Hossain',
    email: 'tanvir@choosify.com.bd',
    role: 'admin',
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
  switchRole: () => {},
  activeBrandId: null,
  setActiveBrandId: () => {},
  sellerBrands: [],
  allBrands: [],
  requestNewBrand: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize seller_brands and allBrands in localStorage
  const [sellerBrands, setSellerBrands] = useState<SellerBrandRelation[]>(() => {
    const saved = localStorage.getItem('choosify_seller_brands');
    if (saved) return JSON.parse(saved);
    const initialSellerBrands: SellerBrandRelation[] = [
      { id: 'sb_1', seller_user_id: 'seller_001', brand_id: 'brand_apex', role: 'Owner', created_at: '2026-06-14T03:54:11-07:00' },
      { id: 'sb_2', seller_user_id: 'seller_001', brand_id: 'brand_urban_fit', role: 'Owner', created_at: '2026-06-14T03:54:11-07:00' },
      { id: 'sb_3', seller_user_id: 'seller_001', brand_id: 'brand_tech_core', role: 'Owner', created_at: '2026-06-14T03:54:11-07:00' },
    ];
    localStorage.setItem('choosify_seller_brands', JSON.stringify(initialSellerBrands));
    return initialSellerBrands;
  });

  const [allBrands, setAllBrands] = useState<{ id: string; name: string; category: string }[]>(() => {
    const saved = localStorage.getItem('choosify_all_brands');
    if (saved) return JSON.parse(saved);
    const initialAllBrands = [
      { id: 'brand_apex', name: 'Apex', category: 'Footwear & Apparel' },
      { id: 'brand_urban_fit', name: 'Urban Fit', category: 'Active Wear' },
      { id: 'brand_tech_core', name: 'TechCore', category: 'Consumer Tech' },
      { id: '1', name: 'Samsung Bangladesh', category: 'Electronics & Mobile' },
      { id: '2', name: 'Aarong', category: 'Fashion & Lifestyle' },
      { id: '3', name: 'Walton', category: 'Electronics & Home' },
      { id: '4', name: 'Xiaomi', category: 'Mobile & Smart Home' },
      { id: '5', name: 'Unilever BD', category: 'Beauty & FMCG' },
    ];
    localStorage.setItem('choosify_all_brands', JSON.stringify(initialAllBrands));
    return initialAllBrands;
  });

  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(null);

  const setActiveBrandId = (id: string | null) => {
    setActiveBrandIdState(id);
    if (id) {
      localStorage.setItem('choosify_active_brand_id', id);
    } else {
      localStorage.removeItem('choosify_active_brand_id');
    }
  };

  useEffect(() => {
    // Load profile from local storage if exists
    const savedRole = localStorage.getItem('choosify_mock_role') as UserRole;
    if (savedRole && mockProfiles[savedRole]) {
      setProfile(mockProfiles[savedRole]);
    }
    setLoading(false);
  }, []);

  // When profile loads or changes, manage activeBrandId
  useEffect(() => {
    if (profile && profile.role === 'seller') {
      const savedBrandId = localStorage.getItem('choosify_active_brand_id');
      const userBrandRelations = sellerBrands.filter(b => b.seller_user_id === profile.id);
      
      if (savedBrandId && userBrandRelations.some(r => r.brand_id === savedBrandId)) {
        setActiveBrandIdState(savedBrandId);
      } else if (userBrandRelations.length > 0) {
        setActiveBrandId(userBrandRelations[0].brand_id);
      } else {
        setActiveBrandIdState(null);
      }
    } else {
      setActiveBrandIdState(null);
    }
  }, [profile, sellerBrands]);

  const login = (role: UserRole) => {
    setProfile(mockProfiles[role]);
    localStorage.setItem('choosify_mock_role', role);
  };

  const logout = () => {
    setProfile(null);
    localStorage.removeItem('choosify_mock_role');
    localStorage.removeItem('choosify_active_brand_id');
  };

  const switchRole = (role: UserRole) => {
    setProfile(mockProfiles[role]);
    localStorage.setItem('choosify_mock_role', role);
  };

  const requestNewBrand = (name: string, category: string) => {
    const brandId = 'brand_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // 1. Add to allBrands
    const newBrand = { id: brandId, name, category };
    const updatedBrands = [...allBrands, newBrand];
    setAllBrands(updatedBrands);
    localStorage.setItem('choosify_all_brands', JSON.stringify(updatedBrands));

    // 2. Add relation for current seller
    if (profile && profile.role === 'seller') {
      const newRelation: SellerBrandRelation = {
        id: 'sb_' + Date.now(),
        seller_user_id: profile.id,
        brand_id: brandId,
        role: 'Owner',
        created_at: new Date().toISOString()
      };
      const updatedRelations = [...sellerBrands, newRelation];
      setSellerBrands(updatedRelations);
      localStorage.setItem('choosify_seller_brands', JSON.stringify(updatedRelations));
      
      // Set active to newly created brand
      setActiveBrandId(brandId);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user: profile ? { uid: profile.id, email: profile.email } : null, 
      profile, 
      loading,
      login,
      logout,
      switchRole,
      activeBrandId,
      setActiveBrandId,
      sellerBrands,
      allBrands,
      requestNewBrand
    }}>
      {children}
    </AuthContext.Provider>
  );
};
