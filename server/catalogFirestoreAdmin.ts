import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
} from '../src/types/catalog';
import {
  collectionHasDocuments,
  deleteDocument,
  getDocumentById,
  listCollection,
  upsertDocument,
  upsertDocumentById,
} from './lib/firestore/queryHelpers';

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';
const HOMEPAGE_DOC = { collection: 'settings', id: 'catalog_homepage' } as const;

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

  getHomepage: () => getDocumentById<HomepageConfig>(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id),
  upsertHomepage: (homepage: HomepageConfig) =>
    upsertDocumentById(HOMEPAGE_DOC.collection, HOMEPAGE_DOC.id, homepage),

  hasAnyProducts: () => collectionHasDocuments(PRODUCTS_COLLECTION, 1),
};
