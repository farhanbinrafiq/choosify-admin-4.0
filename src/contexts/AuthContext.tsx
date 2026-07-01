import React, { createContext, useContext, useEffect, useState } from 'react';
import { CategoryType } from '../types';
import { catalogApi } from '../services/catalogApi';

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
  const [catalogSynced, setCatalogSynced] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function hydrateCatalog() {
      try {
        const [remoteBrands, remoteCategories] = await Promise.all([
          catalogApi.listBrands(),
          catalogApi.listCategories(),
        ]);

        if (!cancelled) {
          if (remoteBrands.length > 0) {
            const mappedBrands = remoteBrands.map((brand) => ({
              id: brand.id,
              name: brand.name,
              category: brand.category,
            }));
            setAllBrands(mappedBrands);
            localStorage.setItem('choosify_all_brands', JSON.stringify(mappedBrands));
          }

          if (remoteCategories.length > 0) {
            const mappedCategories: CategoryType[] = remoteCategories.map((category) => ({
              id: category.id,
              parentId: category.parentId,
              name: category.name,
              slug: category.slug,
              icon: category.icon,
              description: category.description,
              displayOrder: category.displayOrder,
              enabled: category.enabled,
            }));
            setCategories(mappedCategories);
            localStorage.setItem('choosify_categories', JSON.stringify(mappedCategories));
          }
          setCatalogSynced(true);
        }
      } catch (error) {
        console.warn('[AuthContext] Catalog API hydrate failed, using local fallback.', error);
      }
    }

    hydrateCatalog();
    return () => {
      cancelled = true;
    };
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
    catalogApi
      .createBrand({
        id: brandId,
        name,
        category,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: '',
        logo: name.slice(0, 2).toUpperCase(),
      })
      .catch((error) => {
        console.warn('[AuthContext] Failed to persist new brand.', error);
      });

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
  const [categories, setCategories] = useState<CategoryType[]>(() => {
    const saved = localStorage.getItem('choosify_categories');
    if (saved) return JSON.parse(saved);
    const initialCategories: CategoryType[] = [
      { id: 'cat-fashion', parentId: null, name: 'Fashion & Apparel', slug: 'fashion-apparel', icon: 'Shirt', description: 'Clothing, traditional apparel, sarees, panjabis and wearable accessories.', displayOrder: 1, enabled: true },
      { id: 'cat-sarees', parentId: 'cat-fashion', name: 'Jamdani & Silk Sarees', slug: 'sarees', icon: 'Layers', description: 'Traditional Jamdani, silk, and boutique sarees of Bangladesh.', displayOrder: 1, enabled: true },
      { id: 'cat-panjabis', parentId: 'cat-fashion', name: 'Panjabis', slug: 'panjabis', icon: 'User', description: 'Traditional and designer Panjabis for men.', displayOrder: 2, enabled: true },
      { id: 'cat-electronics', parentId: null, name: 'Electronics & Gadgets', slug: 'electronics-gadgets', icon: 'Smartphone', description: 'Smartphones, home devices, chargers, and tech accessories.', displayOrder: 2, enabled: true },
      { id: 'cat-smartphones', parentId: 'cat-electronics', name: 'Smartphones', slug: 'smartphones', icon: 'Tablet', description: 'Latest smartphones from trusted global and local brands.', displayOrder: 1, enabled: true },
      { id: 'cat-groceries', parentId: null, name: 'Organic Groceries', slug: 'organic-groceries', icon: 'Apple', description: 'Fresh, organic, and locally sourced safe food items.', displayOrder: 3, enabled: true },
      { id: 'cat-home', parentId: null, name: 'Home & Living', slug: 'home-living', icon: 'Home', description: 'Furniture, kitchen items, and home decor items.', displayOrder: 4, enabled: true },
    ];
    localStorage.setItem('choosify_categories', JSON.stringify(initialCategories));
    return initialCategories;
  });

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
    localStorage.setItem('choosify_categories', JSON.stringify(updated));
    catalogApi
      .createCategory(newCategory)
      .catch((error) => {
        console.warn('[AuthContext] Failed to persist new category.', error);
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
    localStorage.setItem('choosify_categories', JSON.stringify(updated));
    const target = updated.find((item) => item.id === id);
    if (target) {
      catalogApi.updateCategory(id, target).catch((error) => {
        console.warn('[AuthContext] Failed to persist category update.', error);
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
    localStorage.setItem('choosify_categories', JSON.stringify(updated));
    catalogApi.deleteCategory(id).catch((error) => {
      console.warn('[AuthContext] Failed to delete category from API.', error);
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
    localStorage.setItem('choosify_categories', JSON.stringify(updated));
    const target = updated.find((item) => item.id === id);
    if (target) {
      catalogApi.updateCategory(id, target).catch((error) => {
        console.warn('[AuthContext] Failed to persist moved category.', error);
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
    localStorage.setItem('choosify_categories', JSON.stringify(updated));
    const target = updated.find((item) => item.id === id);
    if (target) {
      catalogApi.updateCategory(id, target).catch((error) => {
        console.warn('[AuthContext] Failed to persist reordered category.', error);
      });
    }
  };

  const importCategories = (imported: CategoryType[]) => {
    setCategories(imported);
    localStorage.setItem('choosify_categories', JSON.stringify(imported));
    Promise.all(
      imported.map((category) => catalogApi.updateCategory(category.id, category).catch(() => catalogApi.createCategory(category)))
    ).catch((error) => {
      console.warn('[AuthContext] Failed to persist imported categories.', error);
    });
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
