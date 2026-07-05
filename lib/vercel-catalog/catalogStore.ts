import type {
  CatalogBrand,
  CatalogBrandPost,
  CatalogCategory,
  CatalogCreator,
  CatalogDeal,
  CatalogGuide,
  CatalogPlacement,
  CatalogProduct,
  CatalogProductDetail,
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
import {
  defaultCreators,
  defaultGuides,
  defaultPlacements,
  defaultProductDetails,
} from './catalogEditorialDefaults';
import { catalogStore as memoryStore } from './catalogMemoryStore';
import { hasFirebaseAdminCredentials } from './firebaseAdmin';

export { defaultHomepage } from './catalogDefaults';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';
const CREATORS_COLLECTION = 'catalog_creators';
const GUIDES_COLLECTION = 'catalog_guides';
const PLACEMENTS_COLLECTION = 'catalog_placements';
const PRODUCT_DETAILS_COLLECTION = 'catalog_product_details';
const BRAND_POSTS_COLLECTION = 'catalog_brand_posts';

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
      case CREATORS_COLLECTION:
        return admin.listCreators() as Promise<T[]>;
      case GUIDES_COLLECTION:
        return admin.listGuides() as Promise<T[]>;
      case PLACEMENTS_COLLECTION:
        return admin.listPlacements() as Promise<T[]>;
      case PRODUCT_DETAILS_COLLECTION:
        return admin.listProductDetails() as Promise<T[]>;
      case BRAND_POSTS_COLLECTION:
        return admin.listBrandPosts() as Promise<T[]>;
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
    case CREATORS_COLLECTION:
      return memoryStore.listCreators() as Promise<T[]>;
    case GUIDES_COLLECTION:
      return memoryStore.listGuides() as Promise<T[]>;
    case PLACEMENTS_COLLECTION:
      return memoryStore.listPlacements() as Promise<T[]>;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryStore.listProductDetails() as Promise<T[]>;
    case BRAND_POSTS_COLLECTION:
      return memoryStore.listBrandPosts() as Promise<T[]>;
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
    case CREATORS_COLLECTION:
      return memoryStore.getCreator(id) as Promise<T | null>;
    case GUIDES_COLLECTION:
      return memoryStore.getGuide(id) as Promise<T | null>;
    case PLACEMENTS_COLLECTION:
      return memoryStore.getPlacement(id) as Promise<T | null>;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryStore.getProductDetail(id) as Promise<T | null>;
    case BRAND_POSTS_COLLECTION:
      return memoryStore.getBrandPost(id) as Promise<T | null>;
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
    case CREATORS_COLLECTION:
      return memoryStore.upsertCreator(data as unknown as CatalogCreator) as unknown as Promise<T>;
    case GUIDES_COLLECTION:
      return memoryStore.upsertGuide(data as unknown as CatalogGuide) as unknown as Promise<T>;
    case PLACEMENTS_COLLECTION:
      return memoryStore.upsertPlacement(data as unknown as CatalogPlacement) as unknown as Promise<T>;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryStore.upsertProductDetail(data as unknown as CatalogProductDetail) as unknown as Promise<T>;
    case BRAND_POSTS_COLLECTION:
      return memoryStore.upsertBrandPost(data as unknown as CatalogBrandPost) as unknown as Promise<T>;
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
    case CREATORS_COLLECTION:
      return memoryStore.deleteCreator(id);
    case GUIDES_COLLECTION:
      return memoryStore.deleteGuide(id);
    case PLACEMENTS_COLLECTION:
      return memoryStore.deletePlacement(id);
    case PRODUCT_DETAILS_COLLECTION:
      return memoryStore.deleteProductDetail(id);
    case BRAND_POSTS_COLLECTION:
      return memoryStore.deleteBrandPost(id);
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
      case CREATORS_COLLECTION:
        return admin.getCreator(id) as Promise<T | null>;
      case GUIDES_COLLECTION:
        return admin.getGuide(id) as Promise<T | null>;
      case PLACEMENTS_COLLECTION:
        return admin.getPlacement(id) as Promise<T | null>;
      case PRODUCT_DETAILS_COLLECTION:
        return admin.getProductDetail(id) as Promise<T | null>;
      case BRAND_POSTS_COLLECTION:
        return admin.getBrandPost(id) as Promise<T | null>;
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
      case CREATORS_COLLECTION:
        return admin.upsertCreator(data as unknown as CatalogCreator) as unknown as Promise<T>;
      case GUIDES_COLLECTION:
        return admin.upsertGuide(data as unknown as CatalogGuide) as unknown as Promise<T>;
      case PLACEMENTS_COLLECTION:
        return admin.upsertPlacement(data as unknown as CatalogPlacement) as unknown as Promise<T>;
      case PRODUCT_DETAILS_COLLECTION:
        return admin.upsertProductDetail(data as unknown as CatalogProductDetail) as unknown as Promise<T>;
      case BRAND_POSTS_COLLECTION:
        return admin.upsertBrandPost(data as unknown as CatalogBrandPost) as unknown as Promise<T>;
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
      case CREATORS_COLLECTION:
        return admin.deleteCreator(id);
      case GUIDES_COLLECTION:
        return admin.deleteGuide(id);
      case PLACEMENTS_COLLECTION:
        return admin.deletePlacement(id);
      case PRODUCT_DETAILS_COLLECTION:
        return admin.deleteProductDetail(id);
      case BRAND_POSTS_COLLECTION:
        return admin.deleteBrandPost(id);
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

  listCreators: () => listCollection<CatalogCreator>(CREATORS_COLLECTION),
  getCreator: (id: string) => getById<CatalogCreator>(CREATORS_COLLECTION, id),
  upsertCreator: (payload: CatalogCreator) => upsert(CREATORS_COLLECTION, payload),
  deleteCreator: (id: string) => remove(CREATORS_COLLECTION, id),

  listGuides: () => listCollection<CatalogGuide>(GUIDES_COLLECTION),
  getGuide: (id: string) => getById<CatalogGuide>(GUIDES_COLLECTION, id),
  upsertGuide: (payload: CatalogGuide) => upsert(GUIDES_COLLECTION, payload),
  deleteGuide: (id: string) => remove(GUIDES_COLLECTION, id),

  listPlacements: () => listCollection<CatalogPlacement>(PLACEMENTS_COLLECTION),
  getPlacement: (id: string) => getById<CatalogPlacement>(PLACEMENTS_COLLECTION, id),
  upsertPlacement: (payload: CatalogPlacement) => upsert(PLACEMENTS_COLLECTION, payload),
  deletePlacement: (id: string) => remove(PLACEMENTS_COLLECTION, id),

  listProductDetails: () => listCollection<CatalogProductDetail>(PRODUCT_DETAILS_COLLECTION),
  getProductDetail: (productId: string) => getById<CatalogProductDetail>(PRODUCT_DETAILS_COLLECTION, productId),
  upsertProductDetail: (payload: CatalogProductDetail) =>
    upsert(PRODUCT_DETAILS_COLLECTION, { ...payload, id: payload.productId }),
  deleteProductDetail: (productId: string) => remove(PRODUCT_DETAILS_COLLECTION, productId),

  listBrandPosts: () => listCollection<CatalogBrandPost>(BRAND_POSTS_COLLECTION),
  getBrandPost: (id: string) => getById<CatalogBrandPost>(BRAND_POSTS_COLLECTION, id),
  upsertBrandPost: (payload: CatalogBrandPost) => upsert(BRAND_POSTS_COLLECTION, payload),
  deleteBrandPost: (id: string) => remove(BRAND_POSTS_COLLECTION, id),

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
    ...defaultCreators().map((item) => catalogStore.upsertCreator(item)),
    ...defaultGuides().map((item) => catalogStore.upsertGuide(item)),
    ...defaultPlacements().map((item) => catalogStore.upsertPlacement(item)),
    ...defaultProductDetails().map((item) => catalogStore.upsertProductDetail(item)),
    catalogStore.upsertHomepage(defaultHomepage()),
    catalogStore.upsertSiteConfig(defaultSiteConfig()),
  ]);

  const mode = useAdminFirestore ? 'firestore-admin' : 'memory';
  console.log(`[Catalog Seed] Seeded default catalog snapshot (${mode}).`);
}

export function getCatalogPersistenceMode(): 'firestore-admin' | 'memory' {
  return useAdminFirestore ? 'firestore-admin' : 'memory';
}
