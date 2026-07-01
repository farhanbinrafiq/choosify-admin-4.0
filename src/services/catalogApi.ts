import type {
  CatalogBrand,
  CatalogCategory,
  CatalogCreator,
  CatalogDeal,
  CatalogGuide,
  CatalogPlacement,
  CatalogProduct,
  CatalogProductDetail,
  HomepageConfig,
  SiteConfig,
} from '../types/catalog';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(path: string, method: HttpMethod = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(rawError || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const catalogApi = {
  listProducts: async (): Promise<CatalogProduct[]> => {
    const result = await request<{ data: CatalogProduct[] }>('/catalog/products');
    return result.data;
  },
  createProduct: async (payload: Partial<CatalogProduct>): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>('/catalog/products', 'POST', payload);
    return result.data;
  },
  updateProduct: async (id: string, payload: Partial<CatalogProduct>): Promise<CatalogProduct> => {
    const result = await request<{ data: CatalogProduct }>(`/catalog/products/${id}`, 'PATCH', payload);
    return result.data;
  },
  deleteProduct: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/catalog/products/${id}`, 'DELETE');
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
};
