import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { refreshAccessToken } from '../services/authRefresh';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'seller'
  | 'verified_seller'
  | 'creator'
  | 'consumer'
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
  changeNextLogin?: boolean;
  username?: string;
  website?: string;
  bio?: string;
  /** Permanent human-readable Choosify User ID (CF-00001…). Immutable. */
  choosifyUserId?: string;
  partnerApplicationStatus?: 'pending' | 'approved' | 'rejected' | null;
  identityVerified?: boolean;
  marketplaceAccess?: boolean;
  partnerApplicationId?: string | null;
  resubmissionRequested?: boolean;
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
  mustChangePassword: boolean;
  loginWithEmail: (email: string, password: string, fallbackRole?: UserRole) => Promise<UserRole>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearMustChangePassword: () => void;
  /** Persists the canonical avatarUrl (PATCH /auth/profile) and updates `profile.avatar`
   *  in place — every surface reading `profile.avatar` (navbar, dropdown, profile page)
   *  updates immediately, no refetch/refresh required. Pass null to remove the photo. */
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
  applyAsPartner: (input: {
    applicantType: 'seller' | 'creator';
    email: string;
    displayName: string;
    businessOrChannelName: string;
    phone: string;
    category: string;
    city: string;
    website?: string;
    password: string;
    niche?: string;
    contentFocus?: string;
    socialPrimary?: string;
    audienceSize?: string;
    notes?: string;
  }) => Promise<{ applicationId: string; status: 'pending'; message: string }>;
  /** @deprecated Direct seller self-registration is closed — use applyAsPartner. */
  registerSeller: (input: {
    email: string;
    displayName: string;
    storeName: string;
    phone: string;
    category: string;
    city: string;
    website?: string;
    password: string;
  }) => Promise<{ role: UserRole; dashboardPath: string }>;
  logout: () => void;
  // Brand Switching Context API for multi-brand sellers
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  sellerBrands: SellerBrandRelation[];
  allBrands: { id: string; name: string; category: string }[];
  requestNewBrand: (name: string, category: string) => Promise<{ id: string; name: string; category: string }>;
  brandsLoading: boolean;
  
  // Categories Management System Integration — all backed by the real
  // /catalog/categories API; each call either persists successfully (and the
  // returned promise resolves with the authoritative server record) or
  // rejects, leaving `categories` state untouched so the UI can surface the
  // failure instead of pretending the change went through.
  categories: CategoryType[];
  categoriesLoading: boolean;
  createCategory: (parentId: string | null, name: string, icon: string, description: string) => Promise<CategoryType>;
  updateCategory: (id: string, updates: Partial<CategoryType>) => Promise<CategoryType>;
  deleteCategory: (id: string) => Promise<boolean>;
  moveCategory: (id: string, newParentId: string | null) => Promise<void>;
  reorderCategory: (id: string, newPosition: number) => Promise<void>;
  importCategories: (imported: CategoryType[]) => Promise<void>;
}

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

function toUserRole(role: string, fallback: UserRole = 'admin'): UserRole {
  const allowed: UserRole[] = [
    'super_admin',
    'admin',
    'seller',
    'verified_seller',
    'creator',
    'consumer',
    'moderator',
    'finance_manager',
    'support_agent',
    'marketing_manager',
  ];
  const normalized = role === 'user' ? 'consumer' : role;
  return allowed.includes(normalized as UserRole) ? (normalized as UserRole) : fallback;
}

const AUTH_TOKEN_KEY = 'choosify_auth_token';

async function fetchAuthProfile(token: string) {
  return fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// refreshAccessToken now lives in services/authRefresh.ts (shared with catalogApi.ts / operationsApi.ts).

class AuthResolveError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthResolveError';
    this.status = status;
  }
}

// Fetches /auth/me; on a 401 it refreshes the access token exactly once and
// retries the same request exactly once before giving up.
// 429 is retried with backoff and never treated as a hard logout signal.
async function resolveAuthProfile(token: string) {
  let response = await fetchAuthProfile(token);

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await fetchAuthProfile(refreshedToken);
    }
  }

  for (let attempt = 0; attempt < 4 && response.status === 429; attempt++) {
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    response = await fetchAuthProfile(token);
  }

  if (!response.ok) {
    throw new AuthResolveError(response.status, 'Unable to resolve admin profile');
  }

  return response.json() as Promise<{
    uid: string;
    email: string;
    displayName: string;
    role: string;
    changeNextLogin?: boolean;
    username?: string;
    website?: string;
    bio?: string;
    avatarUrl?: string;
    choosifyUserId?: string | null;
    partnerApplicationStatus?: 'pending' | 'approved' | 'rejected' | null;
    identityVerified?: boolean;
    marketplaceAccess?: boolean;
    partnerApplicationId?: string | null;
    resubmissionRequested?: boolean;
  }>;
}

function partnerLifecycleFromRemote(remote: {
  partnerApplicationStatus?: 'pending' | 'approved' | 'rejected' | null;
  identityVerified?: boolean;
  marketplaceAccess?: boolean;
  partnerApplicationId?: string | null;
  resubmissionRequested?: boolean;
}): Pick<
  UserProfile,
  | 'partnerApplicationStatus'
  | 'identityVerified'
  | 'marketplaceAccess'
  | 'partnerApplicationId'
  | 'resubmissionRequested'
> {
  return {
    partnerApplicationStatus: remote.partnerApplicationStatus ?? null,
    identityVerified: remote.identityVerified === true,
    marketplaceAccess: remote.marketplaceAccess !== false,
    partnerApplicationId: remote.partnerApplicationId ?? null,
    resubmissionRequested: remote.resubmissionRequested === true,
  };
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true,
  mustChangePassword: false,
  loginWithEmail: async () => 'admin',
  changePassword: async () => {},
  clearMustChangePassword: () => {},
  updateAvatar: async () => {},
  applyAsPartner: async () => ({
    applicationId: '',
    status: 'pending' as const,
    message: '',
  }),
  registerSeller: async () => ({ role: 'seller', dashboardPath: '/seller/products' }),
  logout: () => {},
  activeBrandId: null,
  setActiveBrandId: () => {},
  sellerBrands: [],
  allBrands: [],
  requestNewBrand: async () => ({ id: '', name: '', category: '' }),
  brandsLoading: false,
  categories: [],
  categoriesLoading: true,
  createCategory: async () => ({ id: '', parentId: null, name: '', slug: '', icon: '', description: '', displayOrder: 0, enabled: true }),
  updateCategory: async () => ({ id: '', parentId: null, name: '', slug: '', icon: '', description: '', displayOrder: 0, enabled: true }),
  deleteCategory: async () => false,
  moveCategory: async () => {},
  reorderCategory: async () => {},
  importCategories: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Brands come from the real catalog backend only — never seeded/mocked here.
  // GET /catalog/brands is already ownership-scoped server-side: an authenticated
  // Seller only ever receives brands where sellerId === their own uid.
  const [sellerBrands, setSellerBrands] = useState<SellerBrandRelation[]>([]);
  const [allBrands, setAllBrands] = useState<{ id: string; name: string; category: string }[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

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
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);

      if (token) {
        console.info('[Auth] Restoring session from stored token');
        let restored = false;
        for (let attempt = 0; attempt < 5 && !restored && !cancelled; attempt++) {
          try {
            const remote = await resolveAuthProfile(token);
            if (!cancelled) {
              setProfile({
                id: remote.uid,
                displayName: remote.displayName,
                email: remote.email,
                role: toUserRole(remote.role),
                avatar: remote.avatarUrl || undefined,
                changeNextLogin: remote.changeNextLogin === true,
                username: remote.username,
                website: remote.website,
                bio: remote.bio,
                choosifyUserId: remote.choosifyUserId || undefined,
                ...partnerLifecycleFromRemote(remote),
              });
              console.info('[Auth] Session restored', { uid: remote.uid, role: remote.role });
            }
            restored = true;
          } catch (error) {
            const status = error instanceof AuthResolveError ? error.status : 0;
            // Rate-limit / transient failures must not wipe a still-valid JWT.
            if (status === 429 || status >= 500) {
              console.warn('[Auth] Session restore retry — keeping JWT', { status, attempt });
              await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
              continue;
            }
            console.warn('[Auth] Session restore failed — clearing JWT, remaining unauthenticated', error);
            // StrictMode: a cancelled mount must not erase a token still needed by the remount.
            if (!cancelled) {
              localStorage.removeItem(AUTH_TOKEN_KEY);
              setProfile(null);
            }
            break;
          }
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch this account's real owned Brands from the catalog backend whenever
  // the profile changes. Zero brands is a real, valid state — no auto-create,
  // no fallback to a first/seeded brand (BP-004 §7).
  useEffect(() => {
    let cancelled = false;

    async function loadOwnedBrands() {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!profile || !token) {
        setAllBrands([]);
        setSellerBrands([]);
        setActiveBrandIdState(null);
        return;
      }

      setBrandsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/catalog/brands`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to load brands');
        const payload = (await response.json().catch(() => ({}))) as {
          data?: Array<{ id: string; name: string; category: string }>;
        };
        const brands = Array.isArray(payload.data) ? payload.data : [];
        if (cancelled) return;

        setAllBrands(brands.map((b) => ({ id: b.id, name: b.name, category: b.category })));
        setSellerBrands(
          brands.map((b) => ({
            id: `sb_${b.id}`,
            seller_user_id: profile.id,
            brand_id: b.id,
            role: 'Owner',
            created_at: new Date().toISOString(),
          })),
        );

        const savedBrandId = localStorage.getItem('choosify_active_brand_id');
        if (savedBrandId && brands.some((b) => b.id === savedBrandId)) {
          setActiveBrandIdState(savedBrandId);
        } else if (brands.length > 0) {
          setActiveBrandId(brands[0].id);
        } else {
          setActiveBrandIdState(null);
        }
      } catch (error) {
        console.warn('[Auth] Failed to load owned brands', error);
        if (!cancelled) {
          setAllBrands([]);
          setSellerBrands([]);
          setActiveBrandIdState(null);
        }
      } finally {
        if (!cancelled) setBrandsLoading(false);
      }
    }

    loadOwnedBrands();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const loginWithEmail = async (email: string, password: string, fallbackRole: UserRole = 'super_admin') => {
    console.info('[Auth] Login attempt', { email: email.trim().toLowerCase() });

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      uid?: string;
      email?: string;
      displayName?: string;
      role?: string;
      accessToken?: string;
      changeNextLogin?: boolean;
      username?: string;
      website?: string;
      bio?: string;
      avatarUrl?: string;
      choosifyUserId?: string | null;
      partnerApplicationStatus?: 'pending' | 'approved' | 'rejected' | null;
      identityVerified?: boolean;
      marketplaceAccess?: boolean;
      partnerApplicationId?: string | null;
      resubmissionRequested?: boolean;
    };

    if (!response.ok || !payload.accessToken) {
      console.warn('[Auth] Login failed', { status: response.status, error: payload.error });
      throw new Error(payload.error || 'Invalid email or password');
    }

    localStorage.setItem(AUTH_TOKEN_KEY, payload.accessToken);
    const role = toUserRole(payload.role || '', fallbackRole);
    let nextProfile: UserProfile = {
      id: payload.uid || '',
      displayName: payload.displayName || email.trim(),
      email: payload.email || email.trim(),
      role,
      avatar: payload.avatarUrl || undefined,
      changeNextLogin: payload.changeNextLogin === true,
      username: payload.username,
      website: payload.website,
      bio: payload.bio,
      choosifyUserId: payload.choosifyUserId || undefined,
      ...partnerLifecycleFromRemote(payload),
    };
    // Prefer /auth/me so changeNextLogin and identity extras are authoritative after login.
    try {
      const remote = await resolveAuthProfile(payload.accessToken);
      nextProfile = {
        id: remote.uid,
        displayName: remote.displayName,
        email: remote.email,
        role: toUserRole(remote.role, role),
        avatar: remote.avatarUrl || undefined,
        changeNextLogin: remote.changeNextLogin === true,
        username: remote.username,
        website: remote.website,
        bio: remote.bio,
        choosifyUserId: remote.choosifyUserId || undefined,
        ...partnerLifecycleFromRemote(remote),
      };
    } catch (error) {
      console.warn('[Auth] Post-login /auth/me failed; using login payload', error);
    }
    setProfile(nextProfile);
    console.info('[Auth] Login succeeded', { uid: nextProfile.id, role: nextProfile.role });
    return nextProfile.role;
  };

  const clearMustChangePassword = () => {
    setProfile((prev) => (prev ? { ...prev, changeNextLogin: false } : prev));
  };

  const updateAvatar = async (avatarUrl: string | null) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) throw new Error('Sign in required');
    const response = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ avatarUrl: avatarUrl || '' }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to update profile photo');
    }
    // Optimistic in-place update — every surface reading `profile.avatar`
    // (navbar dropdown, mobile drawer, profile page) re-renders immediately;
    // no /auth/me refetch or page refresh required.
    setProfile((prev) => (prev ? { ...prev, avatar: avatarUrl || undefined } : prev));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) throw new Error('Sign in required');
    if (localStorage.getItem('choosify_impersonation_original_token')) {
      throw new Error('Unavailable during Admin impersonation');
    }
    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to change password');
    }
    clearMustChangePassword();
  };

  const applyAsPartner = async (input: {
    applicantType: 'seller' | 'creator';
    email: string;
    displayName: string;
    businessOrChannelName: string;
    phone: string;
    category: string;
    city: string;
    website?: string;
    password: string;
    niche?: string;
    contentFocus?: string;
    socialPrimary?: string;
    audienceSize?: string;
    notes?: string;
  }) => {
    console.info('[Auth] Partner application submit', {
      email: input.email.trim().toLowerCase(),
      applicantType: input.applicantType,
    });
    const response = await fetch(`${API_BASE}/auth/partner-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantType: input.applicantType,
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: input.displayName.trim(),
        businessOrChannelName: input.businessOrChannelName.trim(),
        storeName: input.businessOrChannelName.trim(),
        phone: input.phone.trim(),
        category: input.category.trim(),
        city: input.city.trim(),
        website: input.website?.trim() || undefined,
        niche: input.niche?.trim() || undefined,
        contentFocus: input.contentFocus?.trim() || undefined,
        socialPrimary: input.socialPrimary?.trim() || undefined,
        audienceSize: input.audienceSize?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      loginPath?: string;
      applicationId?: string;
      status?: 'pending';
      message?: string;
      accessGranted?: boolean;
    };

    if (!response.ok) {
      console.warn('[Auth] Partner application failed', {
        status: response.status,
        code: payload.code,
      });
      const err = new Error(payload.error || 'Unable to submit partner application') as Error & {
        code?: string;
        loginPath?: string;
      };
      err.code = payload.code;
      err.loginPath = payload.loginPath;
      throw err;
    }

    // Account is provisioned on submit; caller redirects to login (no JWT here).
    return {
      applicationId: payload.applicationId || '',
      status: 'pending' as const,
      message:
        payload.message ||
        'Application received. You can sign in now. Marketplace features stay locked until Admin verifies your identity and enables Marketplace Access.',
    };
  };

  /** Closed path — redirects callers to partner application semantics without self-grant. */
  const registerSeller = async (input: {
    email: string;
    displayName: string;
    storeName: string;
    phone: string;
    category: string;
    city: string;
    website?: string;
    password: string;
  }) => {
    await applyAsPartner({
      applicantType: 'seller',
      email: input.email,
      displayName: input.displayName,
      businessOrChannelName: input.storeName,
      phone: input.phone,
      category: input.category,
      city: input.city,
      website: input.website,
      password: input.password,
    });
    const err = new Error(
      'Partner application submitted. You cannot access Seller tools until Admin approval.',
    ) as Error & { code?: string };
    err.code = 'PARTNER_APPLICATION_PENDING';
    throw err;
  };

  const logout = () => {
    console.info('[Auth] Logout');
    const hadToken = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
    setProfile(null);
    localStorage.removeItem('choosify_active_brand_id');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (hadToken) {
      fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch((error) => {
        console.warn('[Auth] Logout request failed', error);
      });
    }
  };

  const requestNewBrand = async (name: string, category: string) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      throw new Error('Sign in required to create a Brand');
    }

    const response = await fetch(`${API_BASE}/catalog/brands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, category }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      data?: { id: string; name: string; category: string };
    };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error || 'Unable to create brand');
    }

    const newBrand = { id: payload.data.id, name: payload.data.name, category: payload.data.category };
    setAllBrands((prev) => [...prev, newBrand]);
    if (profile) {
      setSellerBrands((prev) => [
        ...prev,
        {
          id: `sb_${newBrand.id}`,
          seller_user_id: profile.id,
          brand_id: newBrand.id,
          role: 'Owner',
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setActiveBrandId(newBrand.id);
    return newBrand;
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

  // Every mutation below awaits the real /catalog/categories API call before
  // touching local `categories` state. On failure the promise rejects and
  // local state is left untouched — callers (Categories.tsx) are expected to
  // catch and surface the error rather than assume success.

  const createCategory = async (
    parentId: string | null,
    name: string,
    icon: string,
    description: string,
  ): Promise<CategoryType> => {
    const slug = name.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // The backend enforces slug uniqueness globally (not just within a parent),
    // so dedupe against the full category list to avoid an avoidable 400.
    let uniqueSlug = slug;
    let counter = 1;
    while (categories.some(c => c.slug === uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const draftCategory: CategoryType = {
      id: 'cat-' + Date.now(),
      parentId,
      name,
      slug: uniqueSlug,
      icon,
      description,
      displayOrder: categories.filter(c => c.parentId === parentId).length + 1,
      enabled: true
    };

    const saved = await persistCategoryCreate(draftCategory);
    setCategories(prev => [...prev, saved]);
    return saved;
  };

  const updateCategory = async (id: string, updates: Partial<CategoryType>): Promise<CategoryType> => {
    const current = categories.find(c => c.id === id);
    if (!current) {
      throw new Error(`Category "${id}" was not found.`);
    }

    const merged = { ...current, ...updates };
    if (updates.name && updates.name !== current.name) {
      const slug = updates.name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let uniqueSlug = slug;
      let counter = 1;
      while (categories.some(cat => cat.slug === uniqueSlug && cat.id !== id)) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
      merged.slug = uniqueSlug;
    }

    const saved = await persistCategoryUpdate(merged);
    setCategories(prev => prev.map(c => c.id === id ? saved : c));
    return saved;
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      return false;
    }
    await persistCategoryDelete(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    return true;
  };

  const moveCategory = async (id: string, newParentId: string | null): Promise<void> => {
    if (id === newParentId) return;

    let currentParent = newParentId;
    while (currentParent !== null) {
      if (currentParent === id) return;
      const parentObj = categories.find(c => c.id === currentParent);
      currentParent = parentObj ? parentObj.parentId : null;
    }

    const current = categories.find(c => c.id === id);
    if (!current) {
      throw new Error(`Category "${id}" was not found.`);
    }

    const moved: CategoryType = {
      ...current,
      parentId: newParentId,
      displayOrder: categories.filter(cat => cat.parentId === newParentId).length + 1,
    };

    const saved = await persistCategoryUpdate(moved);
    setCategories(prev => prev.map(c => c.id === id ? saved : c));
  };

  const reorderCategory = async (id: string, newPosition: number): Promise<void> => {
    const targetCategory = categories.find(c => c.id === id);
    if (!targetCategory) return;

    const sameParent = categories.filter(c => c.parentId === targetCategory.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const index = sameParent.findIndex(c => c.id === id);
    if (index === -1) return;

    sameParent.splice(index, 1);
    sameParent.splice(newPosition, 0, targetCategory);

    const reorderedSameParent = sameParent.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));

    // Reorder has no dedicated backend endpoint — it's synthesized as one
    // updateCategory (PATCH) call per affected sibling with a new displayOrder.
    const savedRows = await Promise.all(
      reorderedSameParent.map((category) => persistCategoryUpdate(category)),
    );

    setCategories(prev => prev.map(c => {
      const match = savedRows.find(r => r.id === c.id);
      return match ? match : c;
    }));
  };

  const importCategories = async (imported: CategoryType[]): Promise<void> => {
    await syncAllCategoriesToApi(imported);
    const refreshed = await fetchCategoriesFromApi();
    setCategories(refreshed);
  };

  return (
    <AuthContext.Provider value={{ 
      user: profile ? { uid: profile.id, email: profile.email } : null, 
      profile, 
      loading,
      mustChangePassword: profile?.changeNextLogin === true,
      loginWithEmail,
      changePassword,
      clearMustChangePassword,
      updateAvatar,
      applyAsPartner,
      registerSeller,
      logout,
      activeBrandId,
      setActiveBrandId,
      sellerBrands,
      allBrands,
      requestNewBrand,
      brandsLoading,
      categories,
      categoriesLoading: !categoriesLoaded,
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
