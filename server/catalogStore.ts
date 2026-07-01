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
import { catalogStore as memoryStore } from './catalogMemoryStore';
import { firestoreAdminStore } from './catalogFirestoreAdmin';
import { hasFirebaseAdminCredentials } from './firebaseAdmin';

export { defaultHomepage } from './catalogDefaults';

type Firestore = import('firebase/firestore').Firestore;
type FirestoreModule = typeof import('firebase/firestore');

let firestoreModule: FirestoreModule | null = null;

async function getFirestoreModule(): Promise<FirestoreModule> {
  if (!firestoreModule) {
    firestoreModule = await import('firebase/firestore');
  }
  return firestoreModule;
}

const PRODUCTS_COLLECTION = 'catalog_products';
const CATEGORIES_COLLECTION = 'catalog_categories';
const BRANDS_COLLECTION = 'catalog_brands';
const DEALS_COLLECTION = 'catalog_deals';
const HOMEPAGE_DOC = ['settings', 'catalog_homepage'] as const;

const useAdminFirestore =
  process.env.CATALOG_USE_FIRESTORE === 'true' && hasFirebaseAdminCredentials();

let memoryMode = process.env.CATALOG_USE_FIRESTORE !== 'true' && !useAdminFirestore;
let firestoreDb: Firestore | null = null;
let firestoreLoadAttempted = false;

const enableMemoryMode = (reason: unknown) => {
  if (!memoryMode && !useAdminFirestore) {
    memoryMode = true;
    console.warn('[Catalog Store] Falling back to in-memory persistence.', reason);
  }
};

async function resolveDb(): Promise<Firestore | null> {
  if (memoryMode || useAdminFirestore) return null;
  if (firestoreDb) return firestoreDb;
  if (firestoreLoadAttempted) return null;
  firestoreLoadAttempted = true;
  try {
    const firebaseModule = await import('../src/lib/firebase');
    firestoreDb = firebaseModule.db;
    return firestoreDb;
  } catch (error) {
    enableMemoryMode(error);
    return null;
  }
}

async function listCollection<T>(collectionName: string): Promise<T[]> {
  if (useAdminFirestore) {
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return firestoreAdminStore.listProducts() as Promise<T[]>;
      case CATEGORIES_COLLECTION:
        return firestoreAdminStore.listCategories() as Promise<T[]>;
      case BRANDS_COLLECTION:
        return firestoreAdminStore.listBrands() as Promise<T[]>;
      case DEALS_COLLECTION:
        return firestoreAdminStore.listDeals() as Promise<T[]>;
      default:
        return [];
    }
  }
  if (memoryMode) return listFromMemory<T>(collectionName);
  try {
    const db = await resolveDb();
    if (!db) return listFromMemory<T>(collectionName);
    const { collection, getDocs } = await getFirestoreModule();
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((item) => item.data() as T);
  } catch (error) {
    enableMemoryMode(error);
    return listFromMemory<T>(collectionName);
  }
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
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return firestoreAdminStore.getProduct(id) as Promise<T | null>;
      case CATEGORIES_COLLECTION:
        return firestoreAdminStore.getCategory(id) as Promise<T | null>;
      case BRANDS_COLLECTION:
        return firestoreAdminStore.getBrand(id) as Promise<T | null>;
      case DEALS_COLLECTION:
        return firestoreAdminStore.getDeal(id) as Promise<T | null>;
      default:
        return null;
    }
  }
  if (memoryMode) return getFromMemory<T>(collectionName, id);
  try {
    const db = await resolveDb();
    if (!db) return getFromMemory<T>(collectionName, id);
    const { doc, getDoc } = await getFirestoreModule();
    const snapshot = await getDoc(doc(db, collectionName, id));
    return snapshot.exists() ? (snapshot.data() as T) : null;
  } catch (error) {
    enableMemoryMode(error);
    return getFromMemory<T>(collectionName, id);
  }
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  if (useAdminFirestore) {
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return firestoreAdminStore.upsertProduct(data as unknown as CatalogProduct) as unknown as Promise<T>;
      case CATEGORIES_COLLECTION:
        return firestoreAdminStore.upsertCategory(data as unknown as CatalogCategory) as unknown as Promise<T>;
      case BRANDS_COLLECTION:
        return firestoreAdminStore.upsertBrand(data as unknown as CatalogBrand) as unknown as Promise<T>;
      case DEALS_COLLECTION:
        return firestoreAdminStore.upsertDeal(data as unknown as CatalogDeal) as unknown as Promise<T>;
      default:
        return data;
    }
  }

  await upsertToMemory(collectionName, data);

  if (!memoryMode) {
    try {
      const db = await resolveDb();
      if (db) {
        const { doc, setDoc } = await getFirestoreModule();
        await setDoc(doc(db, collectionName, data.id), data, { merge: true });
      }
    } catch (error) {
      enableMemoryMode(error);
    }
  }
  return data;
}

async function remove(collectionName: string, id: string): Promise<void> {
  if (useAdminFirestore) {
    switch (collectionName) {
      case PRODUCTS_COLLECTION:
        return firestoreAdminStore.deleteProduct(id);
      case CATEGORIES_COLLECTION:
        return firestoreAdminStore.deleteCategory(id);
      case BRANDS_COLLECTION:
        return firestoreAdminStore.deleteBrand(id);
      case DEALS_COLLECTION:
        return firestoreAdminStore.deleteDeal(id);
      default:
        return;
    }
  }

  await removeFromMemory(collectionName, id);

  if (!memoryMode) {
    try {
      const db = await resolveDb();
      if (db) {
        const { doc, deleteDoc } = await getFirestoreModule();
        await deleteDoc(doc(db, collectionName, id));
      }
    } catch (error) {
      enableMemoryMode(error);
    }
  }
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
      const homepage = await firestoreAdminStore.getHomepage();
      return homepage ?? memoryStore.getHomepage();
    }
    if (memoryMode) return memoryStore.getHomepage();
    try {
      const db = await resolveDb();
      if (!db) return memoryStore.getHomepage();
      const { doc, getDoc } = await getFirestoreModule();
      const snapshot = await getDoc(doc(db, ...HOMEPAGE_DOC));
      if (!snapshot.exists()) return memoryStore.getHomepage();
      return snapshot.data() as HomepageConfig;
    } catch (error) {
      enableMemoryMode(error);
      return memoryStore.getHomepage();
    }
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    if (useAdminFirestore) {
      return firestoreAdminStore.upsertHomepage(homepage);
    }
    await memoryStore.upsertHomepage(homepage);
    if (!memoryMode) {
      try {
        const db = await resolveDb();
        if (db) {
          const { doc, setDoc } = await getFirestoreModule();
          await setDoc(doc(db, ...HOMEPAGE_DOC), homepage, { merge: true });
        }
      } catch (error) {
        enableMemoryMode(error);
      }
    }
    return homepage;
  },
};

export async function ensureCatalogSeedData(): Promise<void> {
  try {
    if (useAdminFirestore) {
      const hasProducts = await firestoreAdminStore.hasAnyProducts();
      if (hasProducts) return;
    } else if (!memoryMode) {
      const db = await resolveDb();
      if (db) {
        const { collection, getDocs, limit, query } = await getFirestoreModule();
        const existingProducts = await getDocs(query(collection(db, PRODUCTS_COLLECTION), limit(1)));
        if (!existingProducts.empty) return;
      }
    } else {
      const existing = await memoryStore.listProducts();
      if (existing.length > 0) return;
    }
  } catch (error) {
    enableMemoryMode(error);
  }

  await Promise.all([
    ...defaultCategories().map((item) => catalogStore.upsertCategory(item)),
    ...defaultBrands().map((item) => catalogStore.upsertBrand(item)),
    ...defaultProducts().map((item) => catalogStore.upsertProduct(item)),
    ...defaultDeals().map((item) => catalogStore.upsertDeal(item)),
    catalogStore.upsertHomepage(defaultHomepage()),
  ]);

  const mode = useAdminFirestore ? 'firestore-admin' : memoryMode ? 'memory' : 'firestore-client';
  console.log(`[Catalog Seed] Seeded default catalog snapshot (${mode}).`);
}

export function getCatalogPersistenceMode(): 'firestore-admin' | 'firestore-client' | 'memory' {
  if (useAdminFirestore) return 'firestore-admin';
  if (memoryMode) return 'memory';
  return 'firestore-client';
}
