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
  collectionHasDocuments,
  deleteDocument,
  getDocumentById,
  listCollection,
  upsertDocument,
  upsertDocumentById,
} from '../../server/lib/firestore/queryHelpers';

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

export const firestoreAdminStore = {
  listProducts: () => listCollection<CatalogProduct>(PRODUCTS_COLLECTION),
  getProduct: (id: string) => getDocumentById<CatalogProduct>(PRODUCTS_COLLECTION, id),
  upsertProduct: (payload: CatalogProduct) => upsertDocument(PRODUCTS_COLLECTION, payload),
  deleteProduct: (id: string) => deleteDocument(PRODUCTS_COLLECTION, id),

  listCategories: () => listCollection<CatalogCategory>(CATEGORIES_COLLECTION),
  getCategory: (id: string) => getDocumentById<CatalogCategory>(CATEGORIES_COLLECTION, id),
  upsertCategory: (payload: CatalogCategory) => upsertDocument(CATEGORIES_COLLECTION, payload),
  deleteCategory: (id: string) => deleteDocument(CATEGORIES_COLLECTION, id),

  listBrands: () => listCollection<CatalogBrand>(BRANDS_COLLECTION),
  getBrand: (id: string) => getDocumentById<CatalogBrand>(BRANDS_COLLECTION, id),
  upsertBrand: (payload: CatalogBrand) => upsertDocument(BRANDS_COLLECTION, payload),
  deleteBrand: (id: string) => deleteDocument(BRANDS_COLLECTION, id),

  listDeals: () => listCollection<CatalogDeal>(DEALS_COLLECTION),
  getDeal: (id: string) => getDocumentById<CatalogDeal>(DEALS_COLLECTION, id),
  upsertDeal: (payload: CatalogDeal) => upsertDocument(DEALS_COLLECTION, payload),
  deleteDeal: (id: string) => deleteDocument(DEALS_COLLECTION, id),

  listCreators: () => listCollection<CatalogCreator>(CREATORS_COLLECTION),
  getCreator: (id: string) => getDocumentById<CatalogCreator>(CREATORS_COLLECTION, id),
  upsertCreator: (payload: CatalogCreator) => upsertDocument(CREATORS_COLLECTION, payload),
  deleteCreator: (id: string) => deleteDocument(CREATORS_COLLECTION, id),

  listGuides: () => listCollection<CatalogGuide>(GUIDES_COLLECTION),
  getGuide: (id: string) => getDocumentById<CatalogGuide>(GUIDES_COLLECTION, id),
  upsertGuide: (payload: CatalogGuide) => upsertDocument(GUIDES_COLLECTION, payload),
  deleteGuide: (id: string) => deleteDocument(GUIDES_COLLECTION, id),

  listPlacements: () => listCollection<CatalogPlacement>(PLACEMENTS_COLLECTION),
  getPlacement: (id: string) => getDocumentById<CatalogPlacement>(PLACEMENTS_COLLECTION, id),
  upsertPlacement: (payload: CatalogPlacement) => upsertDocument(PLACEMENTS_COLLECTION, payload),
  deletePlacement: (id: string) => deleteDocument(PLACEMENTS_COLLECTION, id),

  listProductDetails: () => listCollection<CatalogProductDetail>(PRODUCT_DETAILS_COLLECTION),
  getProductDetail: (productId: string) =>
    getDocumentById<CatalogProductDetail>(PRODUCT_DETAILS_COLLECTION, productId),
  upsertProductDetail: (payload: CatalogProductDetail) =>
    upsertDocumentById(PRODUCT_DETAILS_COLLECTION, payload.productId, payload),
  deleteProductDetail: (productId: string) => deleteDocument(PRODUCT_DETAILS_COLLECTION, productId),

  listBrandPosts: () => listCollection<CatalogBrandPost>(BRAND_POSTS_COLLECTION),
  getBrandPost: (id: string) => getDocumentById<CatalogBrandPost>(BRAND_POSTS_COLLECTION, id),
  upsertBrandPost: (payload: CatalogBrandPost) => upsertDocument(BRAND_POSTS_COLLECTION, payload),
  deleteBrandPost: (id: string) => deleteDocument(BRAND_POSTS_COLLECTION, id),

  getHomepage: () => getDocumentById<HomepageConfig>(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id),
  upsertHomepage: (homepage: HomepageConfig) =>
    upsertDocumentById(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id, homepage),

  getSiteConfig: () => getDocumentById<SiteConfig>(SITE_DOC.collection, SITE_DOC.id),
  upsertSiteConfig: (site: SiteConfig) =>
    upsertDocumentById(SITE_DOC.collection, SITE_DOC.id, site),

  hasAnyProducts: () => collectionHasDocuments(PRODUCTS_COLLECTION, 1),
};
