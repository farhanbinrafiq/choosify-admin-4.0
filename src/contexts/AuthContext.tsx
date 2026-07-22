import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { CategoryType } from '../types';
import {
  fetchCategoriesFromApi,
  persistCategoryCreate,
  persistCategoryDelete,
  persistCategoryUpdate,
  syncAllCategoriesToApi,
} from '../lib/categoryCatalogSync';
import {
  CATEGORY_CATALOG_VERSION,
  CATEGORY_VERSION_STORAGE_KEY,
  getCanonicalAdminCategories,
  isStaleCategorySet,
} from '../lib/storefrontCategories';

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
  loginWithEmail: (email: string, password: string, fallbackRole?: UserRole) => Promise<UserRole>;
  registerSeller: (input: {
    email: string;
    password: string;
    displayName: string;
    storeName?: string;
  }) => Promise<{ role: UserRole; dashboardPath: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  // Brand Switching Context API for multi-brand sellers
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  sellerBrands: SellerBrandRelation[];
  allBrands: { id: string; name: string; category: string }[];
  requestNewBrand: (name: string, category: string) => void;
  
  // Categories Management System Integration
  categories: CategoryType[];
  createCategory: (parentId: string | null, name: string, icon: string, description: string) => CategoryType;
  updateCategory: (id: string, updates: Partial<CategoryType>) => void;
  deleteCategory: (id: string) => boolean;
  moveCategory: (id: string, newParentId: string | null) => void;
  reorderCategory: (id: string, newPosition: number) => void;
  importCategories: (imported: CategoryType[]) => void;
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

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

const EMAIL_ROLE_MAP: Record<string, UserRole> = {
  'admin@choosify.com.bd': 'super_admin',
  'finance@choosify.com.bd': 'finance_manager',
  'support@choosify.com.bd': 'support_agent',
  'marketing@choosify.com.bd': 'marketing_manager',
  'moderator@choosify.com.bd': 'moderator',
  'seller@choosify.com.bd': 'seller',
  'creator@choosify.com.bd': 'creator',
};

function toUserRole(role: string, fallback: UserRole = 'admin'): UserRole {
  const allowed: UserRole[] = [
    'super_admin',
    'admin',
    'seller',
    'creator',
    'moderator',
    'finance_manager',
    'support_agent',
    'marketing_manager',
  ];
  return allowed.includes(role as UserRole) ? (role as UserRole) : fallback;
}

async function fetchAuthProfile(token: string) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Unable to resolve admin profile');
  }
  return response.json() as Promise<{
    uid: string;
    email: string;
    displayName: string;
    role: string;
  }>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  login: () => {},
  loginWithEmail: async () => 'admin',
  registerSeller: async () => ({ role: 'seller', dashboardPath: '/seller/products' }),
  logout: () => {},
  switchRole: () => {},
  activeBrandId: null,
  setActiveBrandId: () => {},
  sellerBrands: [],
  allBrands: [],
  requestNewBrand: () => {},
  categories: [],
  createCategory: () => ({ id: '', parentId: null, name: '', slug: '', icon: '', description: '', displayOrder: 0, enabled: true }),
  updateCategory: () => {},
  deleteCategory: () => false,
  moveCategory: () => {},
  reorderCategory: () => {},
  importCategories: () => {}
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('choosify_auth_token', token);
          const remote = await fetchAuthProfile(token);
          setProfile({
            id: remote.uid,
            displayName: remote.displayName,
            email: remote.email,
            role: toUserRole(remote.role),
          });
        } catch {
          const savedRole = localStorage.getItem('choosify_mock_role') as UserRole;
          if (savedRole && mockProfiles[savedRole]) {
            setProfile(mockProfiles[savedRole]);
          }
        }
      } else {
        const savedRole = localStorage.getItem('choosify_mock_role') as UserRole;
        if (savedRole && mockProfiles[savedRole]) {
          setProfile(mockProfiles[savedRole]);
        }
      }
      setLoading(false);
    });
    return unsubscribe;
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

  const loginWithEmail = async (email: string, password: string, fallbackRole: UserRole = 'super_admin') => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await credential.user.getIdToken();
      localStorage.setItem('choosify_auth_token', token);
      const remote = await fetchAuthProfile(token);
      const role = toUserRole(remote.role, fallbackRole);
      const nextProfile: UserProfile = {
        id: remote.uid,
        displayName: remote.displayName,
        email: remote.email,
        role,
      };
      setProfile(nextProfile);
      localStorage.setItem('choosify_mock_role', role);
      return role;
    } catch {
      const mappedRole = EMAIL_ROLE_MAP[email.trim().toLowerCase()] || fallbackRole;
      login(mappedRole);
      return mappedRole;
    }
  };

  const registerSeller = async (input: {
    email: string;
    password: string;
    displayName: string;
    storeName?: string;
  }) => {
    const response = await fetch(`${API_BASE}/auth/seller-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: input.displayName.trim(),
        storeName: input.storeName?.trim() || undefined,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      loginPath?: string;
      customToken?: string;
      uid?: string;
      email?: string;
      displayName?: string;
      role?: string;
      dashboardPath?: string;
    };

    if (!response.ok) {
      const err = new Error(payload.error || 'Unable to create seller account') as Error & {
        code?: string;
        loginPath?: string;
      };
      err.code = payload.code;
      err.loginPath = payload.loginPath;
      throw err;
    }

    if (!payload.customToken) {
      throw new Error('Seller account created but sign-in token was missing.');
    }

    const credential = await signInWithCustomToken(auth, payload.customToken);
    const token = await credential.user.getIdToken();
    localStorage.setItem('choosify_auth_token', token);

    let role: UserRole = 'seller';
    let nextProfile: UserProfile = {
      id: payload.uid || credential.user.uid,
      displayName: payload.displayName || input.displayName.trim(),
      email: payload.email || input.email.trim().toLowerCase(),
      role,
    };

    try {
      const remote = await fetchAuthProfile(token);
      role = toUserRole(remote.role, 'seller');
      nextProfile = {
        id: remote.uid,
        displayName: remote.displayName,
        email: remote.email,
        role,
      };
    } catch {
      // Profile write may lag; use registration payload.
    }

    setProfile(nextProfile);
    localStorage.setItem('choosify_mock_role', role);
    return {
      role,
      dashboardPath: payload.dashboardPath || '/seller/products',
    };
  };

  const logout = () => {
    setProfile(null);
    localStorage.removeItem('choosify_mock_role');
    localStorage.removeItem('choosify_active_brand_id');
    localStorage.removeItem('choosify_auth_token');
    signOut(auth).catch(() => {});
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

  // Categories Management System Implementation
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyCategories = (rows: CategoryType[], source: 'api' | 'local') => {
      const savedVersion = localStorage.getItem(CATEGORY_VERSION_STORAGE_KEY);
      const canonical = getCanonicalAdminCategories();
      const shouldReset =
        savedVersion !== CATEGORY_CATALOG_VERSION || isStaleCategorySet(rows);

      if (shouldReset) {
        if (!cancelled) {
          setCategories(canonical);
          setCategoriesLoaded(true);
        }
        localStorage.setItem(CATEGORY_VERSION_STORAGE_KEY, CATEGORY_CATALOG_VERSION);
        syncAllCategoriesToApi(canonical).catch((error) => {
          console.error('[AuthContext] Failed to sync canonical categories to catalog API.', error);
        });
        return;
      }

      if (!cancelled) {
        setCategories(rows);
        setCategoriesLoaded(true);
      }

      if (source === 'api') {
        localStorage.setItem(CATEGORY_VERSION_STORAGE_KEY, CATEGORY_CATALOG_VERSION);
      }
    };

    fetchCategoriesFromApi()
      .then((rows) => {
        if (!cancelled) {
          applyCategories(rows, 'api');
        }
      })
      .catch((error) => {
        console.warn('[AuthContext] Failed to load categories from catalog API, using local fallback.', error);
        if (cancelled) return;
        const saved = localStorage.getItem('choosify_categories');
        if (saved) {
          applyCategories(JSON.parse(saved) as CategoryType[], 'local');
        } else {
          applyCategories(getCanonicalAdminCategories(), 'local');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!categoriesLoaded) return;
    localStorage.setItem('choosify_categories', JSON.stringify(categories));
  }, [categories, categoriesLoaded]);

  const createCategory = (parentId: string | null, name: string, icon: string, description: string) => {
    const slug = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    let uniqueSlug = slug;
    let counter = 1;
    while (categories.some(c => c.slug === uniqueSlug && c.parentId === parentId)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const newCategory: CategoryType = {
      id: 'cat-' + Date.now(),
      parentId,
      name,
      slug: uniqueSlug,
      icon,
      description,
      displayOrder: categories.filter(c => c.parentId === parentId).length + 1,
      enabled: true
    };

    const updated = [...categories, newCategory];
    setCategories(updated);
    persistCategoryCreate(newCategory).catch((error) => {
      console.error('[AuthContext] Failed to persist new category to catalog API.', error);
    });
    return newCategory;
  };

  const updateCategory = (id: string, updates: Partial<CategoryType>) => {
    const updated = categories.map(c => {
      if (c.id === id) {
        const merged = { ...c, ...updates };
        if (updates.name && updates.name !== c.name) {
          const slug = updates.name.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
          
          let uniqueSlug = slug;
          let counter = 1;
          while (categories.some(cat => cat.slug === uniqueSlug && cat.parentId === c.parentId && cat.id !== id)) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }
          merged.slug = uniqueSlug;
        }
        return merged;
      }
      return c;
    });
    setCategories(updated);
    const changed = updated.find((category) => category.id === id);
    if (changed) {
      persistCategoryUpdate(changed).catch((error) => {
        console.error('[AuthContext] Failed to persist category update to catalog API.', error);
      });
    }
  };

  const deleteCategory = (id: string): boolean => {
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      return false;
    }
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    persistCategoryDelete(id).catch((error) => {
      console.error('[AuthContext] Failed to delete category from catalog API.', error);
    });
    return true;
  };

  const moveCategory = (id: string, newParentId: string | null) => {
    if (id === newParentId) return;
    
    let currentParent = newParentId;
    while (currentParent !== null) {
      if (currentParent === id) return;
      const parentObj = categories.find(c => c.id === currentParent);
      currentParent = parentObj ? parentObj.parentId : null;
    }

    const updated = categories.map(c => {
      if (c.id === id) {
        return { 
          ...c, 
          parentId: newParentId, 
          displayOrder: categories.filter(cat => cat.parentId === newParentId).length + 1 
        };
      }
      return c;
    });
    setCategories(updated);
    const moved = updated.find((category) => category.id === id);
    if (moved) {
      persistCategoryUpdate(moved).catch((error) => {
        console.error('[AuthContext] Failed to persist category move to catalog API.', error);
      });
    }
  };

  const reorderCategory = (id: string, newPosition: number) => {
    const targetCategory = categories.find(c => c.id === id);
    if (!targetCategory) return;

    const sameParent = categories.filter(c => c.parentId === targetCategory.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const index = sameParent.findIndex(c => c.id === id);
    if (index === -1) return;

    sameParent.splice(index, 1);
    sameParent.splice(newPosition, 0, targetCategory);

    const reorderedSameParent = sameParent.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));

    const updated = categories.map(c => {
      const match = reorderedSameParent.find(r => r.id === c.id);
      return match ? match : c;
    });

    setCategories(updated);
    Promise.all(
      reorderedSameParent.map((category) => persistCategoryUpdate(category)),
    ).catch((error) => {
      console.error('[AuthContext] Failed to persist category reorder to catalog API.', error);
    });
  };

  const importCategories = (imported: CategoryType[]) => {
    setCategories(imported);
    syncAllCategoriesToApi(imported).catch((error) => {
      console.error('[AuthContext] Failed to sync imported categories to catalog API.', error);
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user: profile ? { uid: profile.id, email: profile.email } : null, 
      profile, 
      loading,
      login,
      loginWithEmail,
      registerSeller,
      logout,
      switchRole,
      activeBrandId,
      setActiveBrandId,
      sellerBrands,
      allBrands,
      requestNewBrand,
      categories,
      createCategory,
      updateCategory,
      deleteCategory,
      moveCategory,
      reorderCategory,
      importCategories
    }}>
      {children}
    </AuthContext.Provider>
  );
};
