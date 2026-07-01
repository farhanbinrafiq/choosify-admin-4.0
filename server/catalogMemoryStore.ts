import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
} from '../src/types/catalog';
import {
  defaultBrands,
  defaultCategories,
  defaultDeals,
  defaultHomepage,
  defaultProducts,
} from './catalogDefaults';

export { defaultHomepage } from './catalogDefaults';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';

const memoryState: {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  deals: CatalogDeal[];
  homepage: HomepageConfig;
} = {
  products: defaultProducts(),
  categories: defaultCategories(),
  brands: defaultBrands(),
  deals: defaultDeals(),
  homepage: defaultHomepage(),
};

const collectionMemoryRef = (collectionName: string): unknown[] => {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryState.products;
    case CATEGORIES_COLLECTION:
      return memoryState.categories;
    case BRANDS_COLLECTION:
      return memoryState.brands;
    case DEALS_COLLECTION:
      return memoryState.deals;
    default:
      return [];
  }
};

async function listCollection<T>(collectionName: string): Promise<T[]> {
  return [...(collectionMemoryRef(collectionName) as T[])];
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find((item) => item.id === id);
  return (found as T) || null;
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const existingIdx = memoryCollection.findIndex((item) => item.id === data.id);
  if (existingIdx >= 0) {
    memoryCollection[existingIdx] = { ...memoryCollection[existingIdx], ...data } as { id: string };
  } else {
    memoryCollection.push(data as { id: string });
  }
  return data;
}

async function remove(collectionName: string, id: string): Promise<void> {
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const filtered = memoryCollection.filter((item) => item.id !== id);
  memoryCollection.splice(0, memoryCollection.length, ...filtered);
}

export const catalogStore = {
  listProducts: () => listCollection<CatalogProduct>(PRODUCTS_COLLECTION),
  getProduct: (id: string) => getById<CatalogProduct>(PRODUCTS_COLLECTION, id),
  upsertProduct: (payload: CatalogProduct) => upsert(PRODUCTS_COLLECTION, payload),
  deleteProduct: (id: string) => remove(PRODUCTS_COLLECTION, id),

  listCategories: () => listCollection<CatalogCategory>(CATEGORIES_COLLECTION),
  getCategory: (id: string) => getById<CatalogCategory>(CATEGORIES_COLLECTION, id),
  upsertCategory: (payload: CatalogCategory) => upsert(CATEGORIES_COLLECTION, payload),
  deleteCategory: (id: string) => remove(CATEGORIES_COLLECTION, id),

  listBrands: () => listCollection<CatalogBrand>(BRANDS_COLLECTION),
  getBrand: (id: string) => getById<CatalogBrand>(BRANDS_COLLECTION, id),
  upsertBrand: (payload: CatalogBrand) => upsert(BRANDS_COLLECTION, payload),
  deleteBrand: (id: string) => remove(BRANDS_COLLECTION, id),

  listDeals: () => listCollection<CatalogDeal>(DEALS_COLLECTION),
  getDeal: (id: string) => getById<CatalogDeal>(DEALS_COLLECTION, id),
  upsertDeal: (payload: CatalogDeal) => upsert(DEALS_COLLECTION, payload),
  deleteDeal: (id: string) => remove(DEALS_COLLECTION, id),

  async getHomepage(): Promise<HomepageConfig> {
    return memoryState.homepage;
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    memoryState.homepage = homepage;
    return homepage;
  },
};

export async function ensureCatalogSeedData(): Promise<void> {
  await Promise.all([
    ...defaultCategories().map((item) => catalogStore.upsertCategory(item)),
    ...defaultBrands().map((item) => catalogStore.upsertBrand(item)),
    ...defaultProducts().map((item) => catalogStore.upsertProduct(item)),
    ...defaultDeals().map((item) => catalogStore.upsertDeal(item)),
    catalogStore.upsertHomepage(defaultHomepage()),
  ]);

  console.log('[Catalog Seed] Seeded default catalog snapshot (memory mode).');
}
