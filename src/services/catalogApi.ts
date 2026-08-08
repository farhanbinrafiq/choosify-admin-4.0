import type {
  CatalogBrand,
  CatalogBrandPost,
  CatalogCategory,
  CatalogCreator,
  CatalogDeal,
  CatalogDealsBanner,
  CatalogGuide,
  CatalogInventory,
  CatalogPlacement,
  CatalogProduct,
  CatalogProductDetail,
  CatalogService,
  HomepageConfig,
  SiteConfig,
} from '../types/catalog';

export type DraftEntityType = 'brand' | 'product' | 'creator' | 'guide';

export interface EntityDraft {
  id: string;
  entityType: DraftEntityType;
  entityId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
}

export interface EntityVersion {
  id: string;
  entityType: DraftEntityType;
  entityId: string;
  label: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function parseErrorMessage(rawError: string, status: number): string {
  if (!rawError) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(rawError) as { error?: string; message?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message;
  } catch {
    // keep raw text
  }
  return rawError;
}

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Write routes require a Firebase Bearer token (authenticateRequest); some GET
  // routes (draft/version endpoints) are admin-only too, so attach it whenever
  // present — public GET routes simply ignore the header.
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(parseErrorMessage(rawError, response.status));
  }

  return response.json() as Promise<T>;
}

export const catalogApi = {
  listProducts: async (params?: {
    brandId?: string;
    status?: string;
    productType?: string;
    q?: string;
  }): Promise<CatalogProduct[]> => {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    if (params?.status) query.set('status', params.status);
    if (params?.productType) query.set('productType', params.productType);
    if (params?.q) query.set('q', params.q);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const result = await request<{ data: CatalogProduct[] }>(`/catalog/products${suffix}`);
    return result.data;
  },
  createProduct: async (payload: Partial<CatalogProduct> & Record<string, unknown>): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>('/catalog/products', 'POST', payload);
    return result.data;
  },
  updateProduct: async (
    id: string,
    payload: Partial<CatalogProduct> & Record<string, unknown>,
  ): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>(`/catalog/products/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteProduct: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/products/${id}`, 'DELETE');
  },
  archiveProduct: async (id: string): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>(`/catalog/products/${id}/archive`, 'POST');
    return result.data;
  },
  restoreProduct: async (id: string): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>(`/catalog/products/${id}/restore`, 'POST');
    return result.data;
  },
  getProductInventory: async (
    productId: string,
    variantId?: string,
  ): Promise<{ data: CatalogInventory; records: CatalogInventory[] }> => {
    const q = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return request<{ data: CatalogInventory; records: CatalogInventory[] }>(
      `/catalog/products/${productId}/inventory${q}`,
    );
  },
  adjustProductInventory: async (
    productId: string,
    payload: {
      variantId?: string;
      quantity?: number;
      delta?: number;
      reservedQuantity?: number;
      sku?: string;
      lowStockThreshold?: number;
      warehouseId?: string | null;
    },
  ): Promise<{ data: CatalogInventory; product?: CatalogProduct }> => {
    return request<{ data: CatalogInventory; product?: CatalogProduct }>(
      `/catalog/products/${productId}/inventory`,
      'PATCH',
      payload,
    );
  },
  listServices: async (params?: { brandId?: string }): Promise<CatalogService[]> => {
    const query = new URLSearchParams();
    if (params?.brandId) query.set('brandId', params.brandId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const result = await request<{ data: CatalogService[] }>(`/catalog/services${suffix}`);
    return result.data;
  },
  createService: async (payload: Partial<CatalogService> & Record<string, unknown>): Promise<CatalogService> => {
    const result = await request<{ data: CatalogService }>('/catalog/services', 'POST', payload);
    return result.data;
  },
  updateService: async (
    id: string,
    payload: Partial<CatalogService> & Record<string, unknown>,
  ): Promise<CatalogService> => {
    const result = await request<{ data: CatalogService }>(`/catalog/services/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteService: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/services/${id}`, 'DELETE');
  },

  listCategories: async (): Promise<CatalogCategory[]> => {
    const result = await request<{ data: CatalogCategory[] }>('/catalog/categories');
    return result.data;
  },
  createCategory: async (payload: Partial<CatalogCategory>): Promise<CatalogCategory> => {
    const result = await request<{ data: CatalogCategory }>('/catalog/categories', 'POST', payload);
    return result.data;
  },
  updateCategory: async (id: string, payload: Partial<CatalogCategory>): Promise<CatalogCategory> => {
    const result = await request<{ data: CatalogCategory }>(`/catalog/categories/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteCategory: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/categories/${id}`, 'DELETE');
  },

  listBrands: async (): Promise<CatalogBrand[]> => {
    const result = await request<{ data: CatalogBrand[] }>('/catalog/brands');
    return result.data;
  },
  createBrand: async (payload: Partial<CatalogBrand>): Promise<CatalogBrand> => {
    const result = await request<{ data: CatalogBrand }>('/catalog/brands', 'POST', payload);
    return result.data;
  },
  updateBrand: async (id: string, payload: Partial<CatalogBrand>): Promise<CatalogBrand> => {
    const result = await request<{ data: CatalogBrand }>(`/catalog/brands/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteBrand: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/brands/${id}`, 'DELETE');
  },
  /** Admin-only ES-005 Marketplace Access lifecycle transition. */
  setBrandMarketplaceAccess: async (
    id: string,
    status: NonNullable<CatalogBrand['marketplaceStatus']>,
  ): Promise<{ data: CatalogBrand; warning?: string | null }> => {
    return request<{ success: boolean; data: CatalogBrand; warning?: string | null }>(
      `/catalog/brands/${id}/marketplace-access`,
      'PATCH',
      { status },
    );
  },

  listDeals: async (): Promise<CatalogDeal[]> => {
    const result = await request<{ data: CatalogDeal[] }>('/catalog/deals');
    return result.data;
  },
  createDeal: async (payload: Partial<CatalogDeal>): Promise<CatalogDeal> => {
    const result = await request<{ data: CatalogDeal }>('/catalog/deals', 'POST', payload);
    return result.data;
  },
  updateDeal: async (id: string, payload: Partial<CatalogDeal>): Promise<CatalogDeal> => {
    const result = await request<{ data: CatalogDeal }>(`/catalog/deals/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteDeal: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/deals/${id}`, 'DELETE');
  },

  listDealsBanners: async (opts?: { active?: boolean }): Promise<CatalogDealsBanner[]> => {
    const active = opts?.active === false ? 'false' : 'true';
    const result = await request<{ data: CatalogDealsBanner[] }>(
      `/catalog/deals-banners?active=${active}`,
    );
    return result.data;
  },
  createDealsBanner: async (
    payload: Partial<CatalogDealsBanner> & { id?: string },
  ): Promise<CatalogDealsBanner> => {
    const result = await request<{ data: CatalogDealsBanner }>('/catalog/deals-banners', 'POST', payload);
    return result.data;
  },
  updateDealsBanner: async (
    id: string,
    payload: Partial<CatalogDealsBanner>,
  ): Promise<CatalogDealsBanner> => {
    const result = await request<{ data: CatalogDealsBanner }>(
      `/catalog/deals-banners/${id}`,
      'PATCH',
      payload,
    );
    return result.data;
  },
  deleteDealsBanner: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/deals-banners/${id}`, 'DELETE');
  },

  getHomepage: async (): Promise<HomepageConfig> => {
    const result = await request<{ homepage: HomepageConfig }>('/catalog/home');
    return result.homepage;
  },
  updateHomepage: async (payload: HomepageConfig): Promise<HomepageConfig> => {
    const result = await request<{ homepage: HomepageConfig }>('/catalog/home', 'PUT', payload);
    return result.homepage;
  },

  getSiteConfig: async (): Promise<SiteConfig> => {
    const result = await request<{ site: SiteConfig }>('/catalog/site');
    return result.site;
  },
  updateSiteConfig: async (payload: SiteConfig): Promise<SiteConfig> => {
    const result = await request<{ site: SiteConfig }>('/catalog/site', 'PUT', payload);
    return result.site;
  },

  listCreators: async (): Promise<CatalogCreator[]> => {
    const result = await request<{ data: CatalogCreator[] }>('/catalog/creators');
    return result.data;
  },
  upsertCreator: async (id: string, payload: Partial<CatalogCreator>): Promise<CatalogCreator> => {
    const result = await request<{ data: CatalogCreator }>(`/catalog/creators/${id}`, 'PUT', payload);
    return result.data;
  },

  listGuides: async (params?: { status?: string; slug?: string }): Promise<CatalogGuide[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.slug) query.set('slug', params.slug);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const result = await request<{ data: CatalogGuide[] }>(`/catalog/guides${suffix}`);
    return result.data;
  },
  upsertGuide: async (id: string, payload: Partial<CatalogGuide>): Promise<CatalogGuide> => {
    const result = await request<{ data: CatalogGuide }>(`/catalog/guides/${id}`, 'PUT', payload);
    return result.data;
  },

  listPlacements: async (params?: { placement?: string; active?: boolean }): Promise<CatalogPlacement[]> => {
    const query = new URLSearchParams();
    if (params?.placement) query.set('placement', params.placement);
    if (params?.active) query.set('active', 'true');
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const result = await request<{ data: CatalogPlacement[] }>(`/catalog/placements${suffix}`);
    return result.data;
  },
  upsertPlacement: async (id: string, payload: Partial<CatalogPlacement>): Promise<CatalogPlacement> => {
    const result = await request<{ data: CatalogPlacement }>(`/catalog/placements/${id}`, 'PUT', payload);
    return result.data;
  },

  getProductDetail: async (productId: string): Promise<CatalogProductDetail | null> => {
    try {
      return await request<CatalogProductDetail>(`/catalog/product-details/${productId}`);
    } catch {
      return null;
    }
  },
  upsertProductDetail: async (productId: string, payload: Partial<CatalogProductDetail>): Promise<CatalogProductDetail> => {
    const result = await request<{ data: CatalogProductDetail }>(`/catalog/product-details/${productId}`, 'PUT', payload);
    return result.data;
  },

  listBrandPosts: async (params?: { status?: string; slug?: string; brandId?: string }): Promise<CatalogBrandPost[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.slug) query.set('slug', params.slug);
    if (params?.brandId) query.set('brandId', params.brandId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const result = await request<{ data: CatalogBrandPost[] }>(`/catalog/brand-posts${suffix}`);
    return result.data;
  },
  createBrandPost: async (payload: Partial<CatalogBrandPost>): Promise<CatalogBrandPost> => {
    const result = await request<{ data: CatalogBrandPost }>('/catalog/brand-posts', 'POST', payload);
    return result.data;
  },
  updateBrandPost: async (id: string, payload: Partial<CatalogBrandPost>): Promise<CatalogBrandPost> => {
    const result = await request<{ data: CatalogBrandPost }>(`/catalog/brand-posts/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteBrandPost: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/brand-posts/${id}`, 'DELETE');
  },

  getDraft: async (entityType: DraftEntityType, id: string): Promise<EntityDraft | null> => {
    const result = await request<{ data: EntityDraft | null }>(`/catalog/${entityType}/${id}/draft`);
    return result.data;
  },
  saveDraft: async (
    entityType: DraftEntityType,
    id: string,
    data: Record<string, unknown>,
  ): Promise<EntityDraft> => {
    const result = await request<{ data: EntityDraft }>(`/catalog/${entityType}/${id}/draft`, 'PUT', { data });
    return result.data;
  },
  listVersions: async (entityType: DraftEntityType, id: string): Promise<EntityVersion[]> => {
    const result = await request<{ data: EntityVersion[] }>(`/catalog/${entityType}/${id}/versions`);
    return result.data;
  },
  createVersion: async (
    entityType: DraftEntityType,
    id: string,
    label: string,
    snapshot: Record<string, unknown>,
  ): Promise<EntityVersion> => {
    const result = await request<{ data: EntityVersion }>(`/catalog/${entityType}/${id}/versions`, 'POST', {
      label,
      snapshot,
    });
    return result.data;
  },
};
