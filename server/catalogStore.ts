import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
} from '../src/types/catalog';

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

const nowIso = () => new Date().toISOString();

const defaultCategories = (): CatalogCategory[] => {
  const ts = nowIso();
  return [
    {
      id: 'cat-mobile',
      slug: 'mobile-phones',
      name: 'Mobile & Phones',
      description: 'Smartphones and accessories',
      icon: 'Smartphone',
      parentId: null,
      enabled: true,
      displayOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'cat-fashion',
      slug: 'fashion-lifestyle',
      name: 'Fashion & Lifestyle',
      description: 'Apparel and fashion accessories',
      icon: 'Shirt',
      parentId: null,
      enabled: true,
      displayOrder: 1,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'cat-tech',
      slug: 'tech-electronics',
      name: 'Tech & Electronics',
      description: 'Laptops, accessories and gadgets',
      icon: 'Cpu',
      parentId: null,
      enabled: true,
      displayOrder: 2,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultBrands = (): CatalogBrand[] => {
  const ts = nowIso();
  return [
    {
      id: 'brand-samsung',
      slug: 'samsung',
      name: 'Samsung',
      category: 'Electronics',
      description: 'Samsung Bangladesh official storefront',
      logo: 'S',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 12400,
      ratings: 4.8,
      featuredFlag: true,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'brand-apple',
      slug: 'apple',
      name: 'Apple',
      category: 'Tech',
      description: 'Apple products and ecosystem',
      logo: 'A',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 8920,
      ratings: 4.9,
      featuredFlag: true,
      sponsoredFlag: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'brand-apex',
      slug: 'apex',
      name: 'Apex',
      category: 'Fashion',
      description: 'Bangladesh fashion and footwear',
      logo: 'Ap',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 5400,
      ratings: 4.6,
      featuredFlag: false,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultProducts = (): CatalogProduct[] => {
  const ts = nowIso();
  return [
    {
      id: 'prod-s24-ultra',
      slug: 'samsung-galaxy-s24-ultra',
      title: 'Samsung Galaxy S24 Ultra',
      description: 'Flagship Samsung phone with advanced camera features.',
      brandId: 'brand-samsung',
      brandName: 'Samsung',
      categoryId: 'cat-mobile',
      categoryName: 'Mobile & Phones',
      image:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 145000,
      originalPrice: 155000,
      stock: 42,
      status: 'live',
      tags: ['NEW'],
      isDeal: true,
      dealType: 'flash',
      discountPercent: 6.5,
      promoCode: 'S24FLASH',
      dealValidUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      featuredFlag: true,
      isNewArrival: true,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'prod-macbook-air-m3',
      slug: 'apple-macbook-air-m3',
      title: 'Apple MacBook Air M3',
      description: 'Lightweight laptop for creators and professionals.',
      brandId: 'brand-apple',
      brandName: 'Apple',
      categoryId: 'cat-tech',
      categoryName: 'Tech & Electronics',
      image:
        'https://images.unsplash.com/photo-1496181133227-f83bb023945d?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 128000,
      stock: 18,
      status: 'live',
      tags: ['HOT'],
      isDeal: false,
      featuredFlag: true,
      isNewArrival: false,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'prod-apex-loafer',
      slug: 'apex-mens-royal-loafer',
      title: "Apex Men's Royal Loafer",
      description: 'Comfortable premium loafers for everyday style.',
      brandId: 'brand-apex',
      brandName: 'Apex',
      categoryId: 'cat-fashion',
      categoryName: 'Fashion & Lifestyle',
      image:
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 3200,
      originalPrice: 4500,
      stock: 120,
      status: 'live',
      tags: ['SALE'],
      isDeal: true,
      dealType: 'brand',
      discountPercent: 28,
      promoCode: 'APEXFLAT400',
      dealValidUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      featuredFlag: false,
      isNewArrival: true,
      isBestseller: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

const defaultDeals = (): CatalogDeal[] => {
  const ts = nowIso();
  return [
    {
      id: 'deal-s24-flash',
      slug: 's24-flash-deal',
      name: 'S24 Ultra Flash Deal',
      seller: 'Samsung Bangladesh',
      category: 'Electronics',
      status: 'live',
      type: 'retail',
      discountType: 'percentage',
      discountValue: 8,
      promoCode: 'S24FLASH',
      productId: 'prod-s24-ultra',
      brandId: 'brand-samsung',
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'deal-apex-eid',
      slug: 'apex-eid-deal',
      name: 'Apex Eid Special',
      seller: 'Apex',
      category: 'Fashion',
      status: 'pending',
      type: 'retail',
      discountType: 'flat',
      discountValue: 400,
      promoCode: 'APEXFLAT400',
      productId: 'prod-apex-loafer',
      brandId: 'brand-apex',
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultHomepage = (): HomepageConfig => {
  const ts = nowIso();
  return {
    id: 'default',
    heroBanners: [
      {
        id: 'hero-main',
        headline: "Bangladesh's Most Trusted Product Discovery Platform",
        subtitle: 'Manage this content from admin dashboard CMS.',
        ctaText: 'Explore Products',
        ctaUrl: '/products',
        backgroundImage: '',
        isActive: true,
        order: 0,
      },
    ],
    sections: [
      { id: 'featured-products', label: 'Featured Products', isVisible: true, order: 0, itemIds: ['prod-s24-ultra', 'prod-macbook-air-m3'] },
      { id: 'featured-brands', label: 'Featured Brands', isVisible: true, order: 1, itemIds: ['brand-samsung', 'brand-apple'] },
      { id: 'featured-deals', label: 'Featured Deals', isVisible: true, order: 2, itemIds: ['deal-s24-flash'] },
    ],
    featuredProductIds: ['prod-s24-ultra', 'prod-macbook-air-m3'],
    featuredBrandIds: ['brand-samsung', 'brand-apple'],
    featuredDealIds: ['deal-s24-flash'],
    updatedAt: ts,
  };
};

let memoryMode = process.env.CATALOG_USE_FIRESTORE !== 'true';
let firestoreDb: Firestore | null = null;
let firestoreLoadAttempted = false;

const enableMemoryMode = (reason: unknown) => {
  if (!memoryMode) {
    memoryMode = true;
    console.warn('[Catalog Store] Falling back to in-memory persistence.', reason);
  }
};

async function resolveDb(): Promise<Firestore | null> {
  if (memoryMode) return null;
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
  if (memoryMode) return [...(collectionMemoryRef(collectionName) as T[])];
  try {
    const db = await resolveDb();
    if (!db) return [...(collectionMemoryRef(collectionName) as T[])];
    const { collection, getDocs } = await getFirestoreModule();
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((item) => item.data() as T);
  } catch (error) {
    enableMemoryMode(error);
    return [...(collectionMemoryRef(collectionName) as T[])];
  }
}

async function getById<T>(collectionName: string, id: string): Promise<T | null> {
  if (memoryMode) {
    const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find((item) => item.id === id);
    return (found as T) || null;
  }
  try {
    const db = await resolveDb();
    if (!db) {
      const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find((item) => item.id === id);
      return (found as T) || null;
    }
    const { doc, getDoc } = await getFirestoreModule();
    const snapshot = await getDoc(doc(db, collectionName, id));
    return snapshot.exists() ? (snapshot.data() as T) : null;
  } catch (error) {
    enableMemoryMode(error);
    const found = (collectionMemoryRef(collectionName) as Array<{ id: string }>).find((item) => item.id === id);
    return (found as T) || null;
  }
}

async function upsert<T extends { id: string }>(collectionName: string, data: T): Promise<T> {
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const existingIdx = memoryCollection.findIndex((item) => item.id === data.id);
  if (existingIdx >= 0) {
    memoryCollection[existingIdx] = { ...memoryCollection[existingIdx], ...data } as { id: string };
  } else {
    memoryCollection.push(data as { id: string });
  }

  if (!memoryMode) {
    try {
      const db = await resolveDb();
      if (db) {
        const { collection, doc, setDoc } = await getFirestoreModule();
        await setDoc(doc(db, collectionName, data.id), data, { merge: true });
      }
    } catch (error) {
      enableMemoryMode(error);
    }
  }
  return data;
}

async function remove(collectionName: string, id: string): Promise<void> {
  const memoryCollection = collectionMemoryRef(collectionName) as Array<{ id: string }>;
  const filtered = memoryCollection.filter((item) => item.id !== id);
  memoryCollection.splice(0, memoryCollection.length, ...filtered);

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
    if (memoryMode) return memoryState.homepage;
    try {
      const db = await resolveDb();
      if (!db) return memoryState.homepage;
      const { doc, getDoc } = await getFirestoreModule();
      const snapshot = await getDoc(doc(db, ...HOMEPAGE_DOC));
      if (!snapshot.exists()) return memoryState.homepage;
      return snapshot.data() as HomepageConfig;
    } catch (error) {
      enableMemoryMode(error);
      return memoryState.homepage;
    }
  },

  async upsertHomepage(homepage: HomepageConfig): Promise<HomepageConfig> {
    memoryState.homepage = homepage;
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
    if (!memoryMode) {
      const db = await resolveDb();
      if (db) {
        const { collection, getDocs, limit, query } = await getFirestoreModule();
        const existingProducts = await getDocs(query(collection(db, PRODUCTS_COLLECTION), limit(1)));
        if (!existingProducts.empty) {
          return;
        }
      }
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

  console.log(`[Catalog Seed] Seeded default catalog snapshot (${memoryMode ? 'memory' : 'firestore'} mode).`);
}
