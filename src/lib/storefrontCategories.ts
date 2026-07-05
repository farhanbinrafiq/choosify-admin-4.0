import type { CategoryType } from '../types';
import {
  buildDefaultCatalogCategories,
  CATEGORY_CATALOG_VERSION,
  isStaleCategorySet,
  STOREFRONT_CATEGORY_DEFS,
  storefrontCategoryNames,
} from '../../lib/vercel-catalog/storefrontCategories';

export {
  buildDefaultCatalogCategories,
  CATEGORY_CATALOG_VERSION,
  isStaleCategorySet,
  STOREFRONT_CATEGORY_DEFS,
  storefrontCategoryNames,
};

export const getCanonicalAdminCategories = (): CategoryType[] =>
  buildDefaultCatalogCategories().map((category) => ({
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    description: category.description,
    displayOrder: category.displayOrder,
    enabled: category.enabled,
  }));

export const CATEGORY_VERSION_STORAGE_KEY = 'choosify_categories_version';
