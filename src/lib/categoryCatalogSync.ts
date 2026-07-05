import { catalogApi } from '../services/catalogApi';
import type { CatalogCategory } from '../types/catalog';
import type { CategoryType } from '../types';

export const toCategoryType = (category: CatalogCategory): CategoryType => ({
  id: category.id,
  parentId: category.parentId,
  name: category.name,
  slug: category.slug,
  icon: category.icon,
  description: category.description,
  displayOrder: category.displayOrder,
  enabled: category.enabled,
});

export const toCatalogPayload = (category: CategoryType): Partial<CatalogCategory> => ({
  id: category.id,
  parentId: category.parentId,
  name: category.name,
  slug: category.slug,
  icon: category.icon,
  description: category.description,
  displayOrder: category.displayOrder,
  enabled: category.enabled,
});

export async function fetchCategoriesFromApi(): Promise<CategoryType[]> {
  const rows = await catalogApi.listCategories();
  return rows.map(toCategoryType);
}

export async function persistCategoryCreate(category: CategoryType): Promise<void> {
  await catalogApi.createCategory(toCatalogPayload(category));
}

export async function persistCategoryUpdate(category: CategoryType): Promise<void> {
  await catalogApi.updateCategory(category.id, toCatalogPayload(category));
}

export async function persistCategoryDelete(id: string): Promise<void> {
  await catalogApi.deleteCategory(id);
}

export async function syncAllCategoriesToApi(categories: CategoryType[]): Promise<void> {
  const existing = await catalogApi.listCategories();
  const nextIds = new Set(categories.map((category) => category.id));

  await Promise.all(
    existing.filter((category) => !nextIds.has(category.id)).map((category) => catalogApi.deleteCategory(category.id)),
  );

  await Promise.all(
    categories.map((category) => {
      const payload = toCatalogPayload(category);
      if (existing.some((row) => row.id === category.id)) {
        return catalogApi.updateCategory(category.id, payload);
      }
      return catalogApi.createCategory(payload);
    }),
  );
}
