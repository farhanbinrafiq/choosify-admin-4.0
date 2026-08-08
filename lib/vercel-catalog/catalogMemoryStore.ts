import type {
  CatalogBrand,
  CatalogBrandPost,
  CatalogCategory,
  CatalogCategoryAttribute,
  CatalogCreator,
  CatalogDeal,
  CatalogGuide,
  CatalogInventory,
  CatalogPlacement,
  CatalogProduct,
  CatalogProductDetail,
  CatalogService,
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
import { defaultBrandPosts } from './catalogBrandPostDefaults';
import {
  loadCatalogMemorySnapshot,
  scheduleCatalogMemoryPersist,
  type CatalogMemorySnapshot,
} from './catalogMemoryPersistence';

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
const INVENTORY_COLLECTION = 'catalog_inventory';
const SERVICES_COLLECTION = 'catalog_services';
const CATEGORY_ATTRIBUTES_COLLECTION = 'catalog_category_attributes';

const memoryState: {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  categoryAttributes: CatalogCategoryAttribute[];
  brands: CatalogBrand[];
  deals: CatalogDeal[];
  creators: CatalogCreator[];
  guides: CatalogGuide[];
  placements: CatalogPlacement[];
  productDetails: CatalogProductDetail[];
  brandPosts: CatalogBrandPost[];
  inventory: CatalogInventory[];
  services: CatalogService[];
  homepage: HomepageConfig;
  site: SiteConfig;
} = {
  products: defaultProducts(),
  categories: defaultCategories(),
  categoryAttributes: [],
  brands: defaultBrands(),
  deals: defaultDeals(),
  creators: defaultCreators(),
  guides: defaultGuides(),
  placements: defaultPlacements(),
  productDetails: defaultProductDetails(),
  brandPosts: defaultBrandPosts(),
  inventory: [],
  services: [],
  homepage: defaultHomepage(),
  site: defaultSiteConfig(),
};

let hydratedFromDisk = false;

function buildSnapshot(): CatalogMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    products: memoryState.products,
    categories: memoryState.categories,
    categoryAttributes: memoryState.categoryAttributes,
    brands: memoryState.brands,
    deals: memoryState.deals,
    creators: memoryState.creators,
    guides: memoryState.guides,
    placements: memoryState.placements,
    productDetails: memoryState.productDetails,
    brandPosts: memoryState.brandPosts,
    inventory: memoryState.inventory,
    services: memoryState.services,
    homepage: memoryState.homepage,
    site: memoryState.site,
  };
}

function schedulePersist(): void {
  scheduleCatalogMemoryPersist(buildSnapshot);
}

/** Load disk snapshot once (survives local API restarts in non-Firestore mode). */
export function ensureMemoryCatalogHydrated(): boolean {
  if (hydratedFromDisk) return true;
  hydratedFromDisk = true;
  const snapshot = loadCatalogMemorySnapshot();
  if (!snapshot) return false;
  memoryState.products = (snapshot.products as CatalogProduct[]) || memoryState.products;
  memoryState.categories = (snapshot.categories as CatalogCategory[]) || memoryState.categories;
  memoryState.categoryAttributes =
    (snapshot.categoryAttributes as CatalogCategoryAttribute[]) || memoryState.categoryAttributes || [];
  memoryState.brands = (snapshot.brands as CatalogBrand[]) || memoryState.brands;
  memoryState.deals = (snapshot.deals as CatalogDeal[]) || memoryState.deals;
  memoryState.creators = (snapshot.creators as CatalogCreator[]) || memoryState.creators;
  memoryState.guides = (snapshot.guides as CatalogGuide[]) || memoryState.guides;
  memoryState.placements = (snapshot.placements as CatalogPlacement[]) || memoryState.placements;
  memoryState.productDetails =
    (snapshot.productDetails as CatalogProductDetail[]) || memoryState.productDetails;
  memoryState.brandPosts = (snapshot.brandPosts as CatalogBrandPost[]) || memoryState.brandPosts;
  memoryState.inventory = (snapshot.inventory as CatalogInventory[]) || [];
  memoryState.services = (snapshot.services as CatalogService[]) || [];
  if (snapshot.homepage) memoryState.homepage = snapshot.homepage as HomepageConfig;
  if (snapshot.site) memoryState.site = snapshot.site as SiteConfig;
  console.log(
    `[CatalogMemoryPersist] Hydrated snapshot (${memoryState.products.length} products, ${memoryState.inventory.length} inventory, ${memoryState.services.length} services).`,
  );
  return true;
}

ensureMemoryCatalogHydrated();

const collectionMemoryRef = (collectionName: string): unknown[] => {
  switch (collectionName) {
    case PRODUCTS_COLLECTION:
      return memoryState.products;
    case CATEGORIES_COLLECTION:
      return memoryState.categories;
    case CATEGORY_ATTRIBUTES_COLLECTION:
      return memoryState.categoryAttributes;
    case BRANDS_COLLECTION:
      return memoryState.brands;
    case DEALS_COLLECTION:
      return memoryState.deals;
    case CREATORS_COLLECTION:
      return memoryState.creators;
    case GUIDES_COLLECTION:
      return memoryState.guides;
    case PLACEMENTS_COLLECTION:
      return memoryState.placements;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryState.productDetails;
    case BRAND_POSTS_COLLECTION:
      return memoryState.brandPosts;
    case INVENTORY_COLLECTION:
      return memoryState.inventory;
    case SERVICES_COLLECTION:
      return memoryState.services;
    default:
      return [];
  }
};

async function listCollection<T>(collectionName: string): Promise<T[]> {
  return [...(collectionMemoryRef(collectionName) as T[])];
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    const found = memoryState.productDetails.find((item) => item.productId === id);
    return (found as T) || null;
  }
  const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find(
    (item) => item.id === id,
  );
  return (found as T) || null;
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    const detail = data as unknown as CatalogProductDetail;
    const existingIdx = memoryState.productDetails.findIndex(
      (item) => item.productId === detail.productId,
    );
    if (existingIdx >= 0) {
      memoryState.productDetails[existingIdx] = {
        ...memoryState.productDetails[existingIdx],
        ...detail,
      };
    } else {
      memoryState.productDetails.push(detail);
    }
    schedulePersist();
    return data;
  }
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const existingIdx = memoryCollection.findIndex((item) => item.id === data.id);
  if (existingIdx >= 0) {
    memoryCollection[existingIdx] = { ...memoryCollection[existingIdx], ...data } as { id: string };
  } else {
    memoryCollection.push(data as { id: string });
  }
  schedulePersist();
  return data;
}

async function remove(collectionName: string, id: string): Promise<void> {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    memoryState.productDetails = memoryState.productDetails.filter(
      (item) => item.productId !== id,
    );
    schedulePersist();
    return;
  }
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const filtered = memoryCollection.filter((item) => item.id !== id);
  memoryCollection.splice(0, memoryCollection.length, ...filtered);
  schedulePersist();
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

  listCategoryAttributes: () =>
    listCollection<CatalogCategoryAttribute>(CATEGORY_ATTRIBUTES_COLLECTION),
  getCategoryAttribute: (id: string) =>
    getById<CatalogCategoryAttribute>(CATEGORY_ATTRIBUTES_COLLECTION, id),
  upsertCategoryAttribute: (payload: CatalogCategoryAttribute) =>
    upsert(CATEGORY_ATTRIBUTES_COLLECTION, payload),
  deleteCategoryAttribute: (id: string) => remove(CATEGORY_ATTRIBUTES_COLLECTION, id),

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
  getProductDetail: (productId: string) =>
    getById<CatalogProductDetail>(PRODUCT_DETAILS_COLLECTION, productId),
  upsertProductDetail: (payload: CatalogProductDetail) =>
    upsert(PRODUCT_DETAILS_COLLECTION, payload as unknown as { id: string }),
  deleteProductDetail: (productId: string) => remove(PRODUCT_DETAILS_COLLECTION, productId),

  listBrandPosts: () => listCollection<CatalogBrandPost>(BRAND_POSTS_COLLECTION),
  getBrandPost: (id: string) => getById<CatalogBrandPost>(BRAND_POSTS_COLLECTION, id),
  upsertBrandPost: (payload: CatalogBrandPost) => upsert(BRAND_POSTS_COLLECTION, payload),
  deleteBrandPost: (id: string) => remove(BRAND_POSTS_COLLECTION, id),

  listInventory: () => listCollection<CatalogInventory>(INVENTORY_COLLECTION),
  getInventory: (id: string) => getById<CatalogInventory>(INVENTORY_COLLECTION, id),
  upsertInventory: (payload: CatalogInventory) => upsert(INVENTORY_COLLECTION, payload),
  deleteInventory: (id: string) => remove(INVENTORY_COLLECTION, id),

  listServices: () => listCollection<CatalogService>(SERVICES_COLLECTION),
  getService: (id: string) => getById<CatalogService>(SERVICES_COLLECTION, id),
  upsertService: (payload: CatalogService) => upsert(SERVICES_COLLECTION, payload),
  deleteService: (id: string) => remove(SERVICES_COLLECTION, id),

  async getHomepage(): Promise<HomepageConfig> {
    return memoryState.homepage;
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    memoryState.homepage = homepage;
    schedulePersist();
    return homepage;
  },

  async getSiteConfig(): Promise<SiteConfig> {
    return memoryState.site;
  },

  async upsertSiteConfig(site: SiteConfig): Promise<SiteConfig> {
    memoryState.site = site;
    schedulePersist();
    return site;
  },
};

export async function ensureCatalogSeedData(): Promise<void> {
  // Snapshot already has data — do not re-seed over seller/runtime writes.
  if (memoryState.products.length > 0 && loadCatalogMemorySnapshot()) {
    return;
  }
  if (memoryState.products.length > 0) {
    schedulePersist();
    return;
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
    ...defaultBrandPosts().map((item) => catalogStore.upsertBrandPost(item)),
    catalogStore.upsertHomepage(defaultHomepage()),
    catalogStore.upsertSiteConfig(defaultSiteConfig()),
  ]);

  console.log('[Catalog Seed] Seeded default catalog snapshot (memory mode).');
}
