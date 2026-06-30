import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
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
};
