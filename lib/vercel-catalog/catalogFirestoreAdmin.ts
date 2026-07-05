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
import { getAdminFirestore } from './firebaseAdmin';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';
const CREATORS_COLLECTION = 'catalog_creators';
const GUIDES_COLLECTION = 'catalog_guides';
const PLACEMENTS_COLLECTION = 'catalog_placements';
const PRODUCT_DETAILS_COLLECTION = 'catalog_product_details';
const BRAND_POSTS_COLLECTION = 'catalog_brand_posts';
const HOMEPAGE_DOC = { collection: 'settings', id: 'catalog_homepage' } as const;
const SITE_DOC = { collection: 'settings', id: 'catalog_site' } as const;

async function dbOrThrow() {
  const db = await getAdminFirestore();
  if (!db) {
    throw new Error('Firestore Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.');
  }
  return db;
}

async function listCollection<T>(collectionName: string): Promise<T[]> {
  const db = await dbOrThrow();
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  const db = await dbOrThrow();
  const snapshot = await db.collection(collectionName).doc(id).get();
  return snapshot.exists ? (snapshot.data() as T) : null;
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  const db = await dbOrThrow();
  await db.collection(collectionName).doc(data.id).set(data, { merge: true });
  return data;
}

async function remove(collectionName: string, id: string): Promise<void> {
  const db = await dbOrThrow();
  await db.collection(collectionName).doc(id).delete();
}

async function getProductDetailById(productId: string): Promise<CatalogProductDetail | null> {
  const db = await dbOrThrow();
  const snapshot = await db.collection(PRODUCT_DETAILS_COLLECTION).doc(productId).get();
  return snapshot.exists ? (snapshot.data() as CatalogProductDetail) : null;
}

async function upsertProductDetailDoc(payload: CatalogProductDetail): Promise<CatalogProductDetail> {
  const db = await dbOrThrow();
  await db.collection(PRODUCT_DETAILS_COLLECTION).doc(payload.productId).set(payload, { merge: true });
  return payload;
}

export const firestoreAdminStore = {
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
  getProductDetail: (productId: string) => getProductDetailById(productId),
  upsertProductDetail: (payload: CatalogProductDetail) => upsertProductDetailDoc(payload),
  deleteProductDetail: (productId: string) => remove(PRODUCT_DETAILS_COLLECTION, productId),

  listBrandPosts: () => listCollection<CatalogBrandPost>(BRAND_POSTS_COLLECTION),
  getBrandPost: (id: string) => getById<CatalogBrandPost>(BRAND_POSTS_COLLECTION, id),
  upsertBrandPost: (payload: CatalogBrandPost) => upsert(BRAND_POSTS_COLLECTION, payload),
  deleteBrandPost: (id: string) => remove(BRAND_POSTS_COLLECTION, id),

  async getHomepage(): Promise<HomepageConfig | null> {
    const db = await dbOrThrow();
    const snapshot = await db.collection(HOMEPAGE_DOC.collection).doc(HOMEPAGE_DOC.id).get();
    return snapshot.exists ? (snapshot.data() as HomepageConfig) : null;
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    const db = await dbOrThrow();
    await db.collection(HOMEPAGE_DOC.collection).doc(HOMEPAGE_DOC.id).set(homepage, { merge: true });
    return homepage;
  },

  async getSiteConfig(): Promise<SiteConfig | null> {
    const db = await dbOrThrow();
    const snapshot = await db.collection(SITE_DOC.collection).doc(SITE_DOC.id).get();
    return snapshot.exists ? (snapshot.data() as SiteConfig) : null;
  },

  async upsertSiteConfig(site: SiteConfig): Promise<SiteConfig> {
    const db = await dbOrThrow();
    await db.collection(SITE_DOC.collection).doc(SITE_DOC.id).set(site, { merge: true });
    return site;
  },

  async hasAnyProducts(): Promise<boolean> {
    const db = await dbOrThrow();
    const snapshot = await db.collection(PRODUCTS_COLLECTION).limit(1).get();
    return !snapshot.empty;
  },
};
