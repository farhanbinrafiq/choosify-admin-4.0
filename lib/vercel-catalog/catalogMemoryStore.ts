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

export { defaultHomepage } from './catalogDefaults';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';
const CREATORS_COLLECTION = 'catalog_creators';
const GUIDES_COLLECTION = 'catalog_guides';
const PLACEMENTS_COLLECTION = 'catalog_placements';
const PRODUCT_DETAILS_COLLECTION = 'catalog_product_details';

const memoryState: {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  deals: CatalogDeal[];
  creators: CatalogCreator[];
  guides: CatalogGuide[];
  placements: CatalogPlacement[];
  productDetails: CatalogProductDetail[];
  homepage: HomepageConfig;
  site: SiteConfig;
} = {
  products: defaultProducts(),
  categories: defaultCategories(),
  brands: defaultBrands(),
  deals: defaultDeals(),
  creators: defaultCreators(),
  guides: defaultGuides(),
  placements: defaultPlacements(),
  productDetails: defaultProductDetails(),
  homepage: defaultHomepage(),
  site: defaultSiteConfig(),
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
    case CREATORS_COLLECTION:
      return memoryState.creators;
    case GUIDES_COLLECTION:
      return memoryState.guides;
    case PLACEMENTS_COLLECTION:
      return memoryState.placements;
    case PRODUCT_DETAILS_COLLECTION:
      return memoryState.productDetails;
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
  const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find((item) => item.id === id);
  return (found as T) || null;
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    const detail = data as unknown as CatalogProductDetail;
    const existingIdx = memoryState.productDetails.findIndex((item) => item.productId === detail.productId);
    if (existingIdx >= 0) {
      memoryState.productDetails[existingIdx] = { ...memoryState.productDetails[existingIdx], ...detail };
    } else {
      memoryState.productDetails.push(detail);
    }
    return data;
  }
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
  if (collectionName === PRODUCT_DETAILS_COLLECTION) {
    memoryState.productDetails = memoryState.productDetails.filter((item) => item.productId !== id);
    return;
  }
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
  upsertProductDetail: (payload: CatalogProductDetail) => upsert(PRODUCT_DETAILS_COLLECTION, payload as unknown as { id: string }),
  deleteProductDetail: (productId: string) => remove(PRODUCT_DETAILS_COLLECTION, productId),

  async getHomepage(): Promise<HomepageConfig> {
    return memoryState.homepage;
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    memoryState.homepage = homepage;
    return homepage;
  },

  async getSiteConfig(): Promise<SiteConfig> {
    return memoryState.site;
  },

  async upsertSiteConfig(site: SiteConfig): Promise<SiteConfig> {
    memoryState.site = site;
    return site;
  },
};

export async function ensureCatalogSeedData(): Promise<void> {
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

  console.log('[Catalog Seed] Seeded default catalog snapshot (memory mode).');
}
