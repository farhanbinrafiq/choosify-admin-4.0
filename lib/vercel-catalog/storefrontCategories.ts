import type { CatalogCategory } from './catalogTypes';

/** Bump when the storefront category tree changes — triggers admin local reset. */
export const CATEGORY_CATALOG_VERSION = '2026-07-05';

/** Top-level categories aligned with Choosify-Web `src/constants.ts` CATEGORIES. */
export const STOREFRONT_CATEGORY_DEFS = [
  {
    id: 'cat-fashion',
    slug: 'fashion-lifestyle',
    name: 'Fashion & Lifestyle',
    icon: 'Shirt',
    description: 'Apparel, footwear, and lifestyle accessories.',
    displayOrder: 0,
  },
  {
    id: 'cat-jewelry',
    slug: 'jewelry-accessories',
    name: 'Jewelry & Accessories',
    icon: 'Gem',
    description: 'Jewelry, watches, and personal accessories.',
    displayOrder: 1,
  },
  {
    id: 'cat-mobile',
    slug: 'mobile-phones',
    name: 'Mobile & Phones',
    icon: 'Smartphone',
    description: 'Smartphones, tablets, and mobile accessories.',
    displayOrder: 2,
  },
  {
    id: 'cat-sporting',
    slug: 'sporting-playstation',
    name: 'Sporting & Playstation',
    icon: 'Gamepad2',
    description: 'Sports gear, fitness, and PlayStation consoles.',
    displayOrder: 3,
  },
  {
    id: 'cat-gaming',
    slug: 'gaming-entertainment',
    name: 'Gaming & Entertainment',
    icon: 'Monitor',
    description: 'Gaming consoles, PCs, and entertainment tech.',
    displayOrder: 4,
  },
  {
    id: 'cat-food',
    slug: 'food-restaurants',
    name: 'Food & Restaurants',
    icon: 'Utensils',
    description: 'Restaurants, dining, and food delivery.',
    displayOrder: 5,
  },
  {
    id: 'cat-tech',
    slug: 'tech-electronics',
    name: 'Tech & Electronics',
    icon: 'Cpu',
    description: 'Laptops, audio, cameras, and gadgets.',
    displayOrder: 6,
  },
  {
    id: 'cat-appliances',
    slug: 'tv-appliances',
    name: 'TV & Appliances',
    icon: 'Tv',
    description: 'Televisions, home appliances, and kitchen tech.',
    displayOrder: 7,
  },
  {
    id: 'cat-home',
    slug: 'home-living',
    name: 'Home & Living',
    icon: 'Home',
    description: 'Furniture, decor, and home essentials.',
    displayOrder: 8,
  },
  {
    id: 'cat-baby',
    slug: 'baby-maternity',
    name: 'Baby & Maternity',
    icon: 'Baby',
    description: 'Baby care, maternity, and nursery products.',
    displayOrder: 9,
  },
] as const;

export const CANONICAL_CATEGORY_IDS = new Set(
  STOREFRONT_CATEGORY_DEFS.map((category) => category.id),
);

export const STALE_CATEGORY_IDS = new Set([
  'cat-sarees',
  'cat-panjabis',
  'cat-electronics',
  'cat-smartphones',
  'cat-groceries',
]);

const STALE_CATEGORY_NAMES = new Set([
  'Fashion & Apparel',
  'Jamdani & Silk Sarees',
  'Panjabis',
  'Electronics & Gadgets',
  'Smartphones',
  'Organic Groceries',
  'Eyewear & Fragrances',
  'Beauty & Personal Care',
  'Mobile & Wearable',
  'Vehicles & Automotive',
  'Family & Kids',
  'Food & Essentials',
  'Travel & Hospitality',
  'Hobbies & Creativity',
  'Health & Wellness',
  'Education & Learning',
]);

export const storefrontCategoryNames = (): string[] =>
  STOREFRONT_CATEGORY_DEFS.map((category) => category.name);

export const buildDefaultCatalogCategories = (): CatalogCategory[] => {
  const ts = new Date().toISOString();
  return STOREFRONT_CATEGORY_DEFS.map((category) => ({
    ...category,
    parentId: null,
    enabled: true,
    createdAt: ts,
    updatedAt: ts,
  }));
};

type CategoryLike = { id: string; name: string; parentId?: string | null };

export const isStaleCategorySet = (categories: CategoryLike[]): boolean => {
  if (!categories.length) return true;

  const hasStaleId = categories.some((category) => STALE_CATEGORY_IDS.has(category.id));
  const hasStaleName = categories.some((category) => STALE_CATEGORY_NAMES.has(category.name));
  const topLevelIds = new Set(
    categories.filter((category) => !category.parentId).map((category) => category.id),
  );
  const missingCanonical = [...CANONICAL_CATEGORY_IDS].some((id) => !topLevelIds.has(id));

  return hasStaleId || hasStaleName || missingCanonical;
};
