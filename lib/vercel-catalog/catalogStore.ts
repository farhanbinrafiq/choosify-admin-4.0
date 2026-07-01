import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
  SiteConfig,
} from './catalogTypes';
import {
  defaultBrands,
  defaultCategories,
  defaultDeals,
  defaultHomepage,
  defaultProducts,
  defaultSiteConfig,
} from './catalogDefaults';
import { catalogStore as memoryStore } from './catalogMemoryStore';
import { hasFirebaseAdminCredentials } from './firebaseAdmin';

export { defaultHomepage } from './catalogDefaults';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';

const useAdminFirestore =
  process.env.CATALOG_USE_FIRESTORE === 'true' && hasFirebaseAdminCredentials();

let adminStorePromise: Promise<typeof import('./catalogFirestoreAdmin').firestoreAdminStore> | null =
  null;

async function getAdminStore() {
  if (!adminStorePromise) {
    adminStorePromise = import('./catalogFirestoreAdmin').then((mod) => mod.firestoreAdminStore);
  }
  return adminStorePromise;
}

async function listCollection<T>(collectionName: string): Promise<T[]> {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return admin.listProducts() as Promise<T[]>;
      case CATEGORIES_COLLECTION:
        return admin.listCategories() as Promise<T[]>;
      case BRANDS_COLLECTION:
        return admin.listBrands() as Promise<T[]>;
      case DEALS_COLLECTION:
        return admin.listDeals() as Promise<T[]>;
      default:
        return [];
    }
  }
  return listFromMemory<T>(collectionName);
}

function listFromMemory<T>(collectionName: string): Promise<T[]> {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryStore.listProducts() as Promise<T[]>;
    case CATEGORIES_COLLECTION:
      return memoryStore.listCategories() as Promise<T[]>;
    case BRANDS_COLLECTION:
      return memoryStore.listBrands() as Promise<T[]>;
    case DEALS_COLLECTION:
      return memoryStore.listDeals() as Promise<T[]>;
    default:
      return Promise.resolve([]);
  }
}

function getFromMemory<T>(collectionName: string, id: string): Promise<T | null> {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryStore.getProduct(id) as Promise<T | null>;
    case CATEGORIES_COLLECTION:
      return memoryStore.getCategory(id) as Promise<T | null>;
    case BRANDS_COLLECTION:
      return memoryStore.getBrand(id) as Promise<T | null>;
    case DEALS_COLLECTION:
      return memoryStore.getDeal(id) as Promise<T | null>;
    default:
      return Promise.resolve(null);
  }
}

function upsertToMemory<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryStore.upsertProduct(data as unknown as CatalogProduct) as unknown as Promise<T>;
    case CATEGORIES_COLLECTION:
      return memoryStore.upsertCategory(data as unknown as CatalogCategory) as unknown as Promise<T>;
    case BRANDS_COLLECTION:
      return memoryStore.upsertBrand(data as unknown as CatalogBrand) as unknown as Promise<T>;
    case DEALS_COLLECTION:
      return memoryStore.upsertDeal(data as unknown as CatalogDeal) as unknown as Promise<T>;
    default:
      return Promise.resolve(data);
  }
}

function removeFromMemory(collectionName: string, id: string): Promise<void> {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryStore.deleteProduct(id);
    case CATEGORIES_COLLECTION:
      return memoryStore.deleteCategory(id);
    case BRANDS_COLLECTION:
      return memoryStore.deleteBrand(id);
    case DEALS_COLLECTION:
      return memoryStore.deleteDeal(id);
    default:
      return Promise.resolve();
  }
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return admin.getProduct(id) as Promise<T | null>;
      case CATEGORIES_COLLECTION:
        return admin.getCategory(id) as Promise<T | null>;
      case BRANDS_COLLECTION:
        return admin.getBrand(id) as Promise<T | null>;
      case DEALS_COLLECTION:
        return admin.getDeal(id) as Promise<T | null>;
      default:
        return null;
    }
  }
  return getFromMemory<T>(collectionName, id);
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return admin.upsertProduct(data as unknown as CatalogProduct) as unknown as Promise<T>;
      case CATEGORIES_COLLECTION:
        return admin.upsertCategory(data as unknown as CatalogCategory) as unknown as Promise<T>;
      case BRANDS_COLLECTION:
        return admin.upsertBrand(data as unknown as CatalogBrand) as unknown as Promise<T>;
      case DEALS_COLLECTION:
        return admin.upsertDeal(data as unknown as CatalogDeal) as unknown as Promise<T>;
      default:
        return data;
    }
  }
  return upsertToMemory(collectionName, data);
}

async function remove(collectionName: string, id: string): Promise<void> {
  if (useAdminFirestore) {
    const admin = await getAdminStore();
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return admin.deleteProduct(id);
      case CATEGORIES_COLLECTION:
        return admin.deleteCategory(id);
      case BRANDS_COLLECTION:
        return admin.deleteBrand(id);
      case DEALS_COLLECTION:
        return admin.deleteDeal(id);
      default:
        return;
    }
  }
  return removeFromMemory(collectionName, id);
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
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      const homepage = await admin.getHomepage();
      return homepage ?? memoryStore.getHomepage();
    }
    return memoryStore.getHomepage();
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      return admin.upsertHomepage(homepage);
    }
    return memoryStore.upsertHomepage(homepage);
  },

  async getSiteConfig(): Promise<SiteConfig> {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      const site = await admin.getSiteConfig();
      return site ?? memoryStore.getSiteConfig();
    }
    return memoryStore.getSiteConfig();
  },

  async upsertSiteConfig(site: SiteConfig): Promise<SiteConfig> {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      return admin.upsertSiteConfig(site);
    }
    return memoryStore.upsertSiteConfig(site);
  },
};

export async function ensureCatalogSeedData(): Promise<void> {
  try {
    if (useAdminFirestore) {
      const admin = await getAdminStore();
      const hasProducts = await admin.hasAnyProducts();
      if (hasProducts) return;
    } else {
      const existing = await memoryStore.listProducts();
      if (existing.length > 0) return;
    }
  } catch (error) {
    console.warn('[Catalog Seed] Seed check failed, continuing with defaults.', error);
  }

  await Promise.all([
    ...defaultCategories().map((item) => catalogStore.upsertCategory(item)),
    ...defaultBrands().map((item) => catalogStore.upsertBrand(item)),
    ...defaultProducts().map((item) => catalogStore.upsertProduct(item)),
    ...defaultDeals().map((item) => catalogStore.upsertDeal(item)),
    catalogStore.upsertHomepage(defaultHomepage()),
    catalogStore.upsertSiteConfig(defaultSiteConfig()),
  ]);

  const mode = useAdminFirestore ? 'firestore-admin' : 'memory';
  console.log(`[Catalog Seed] Seeded default catalog snapshot (${mode}).`);
}

export function getCatalogPersistenceMode(): 'firestore-admin' | 'memory' {
  return useAdminFirestore ? 'firestore-admin' : 'memory';
}
