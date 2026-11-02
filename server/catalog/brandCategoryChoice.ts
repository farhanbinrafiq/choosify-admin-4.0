/**
 * One validation for a brand's category choice from the two-level picker
 * (community profiles, Brand Studio, seller sign-up):
 *  - categoryId must be an enabled MAIN category;
 *  - subcategoryId, when given, must be an enabled child of that main category;
 *  - categoryRequest is free text for "couldn't find my category" (kept short),
 *    reviewed by staff in Category Management.
 * Returns the fields to store on the brand (`category` = main category name, the
 * display label the storefront already uses).
 */
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';

export type BrandCategoryChoice = {
  categoryId?: string;
  subcategoryId?: string;
  categoryRequest?: string;
};

export type ResolvedBrandCategory = {
  category: string;
  categoryId: string;
  /** '' = no subcategory (clears a stored one). */
  subcategoryId: string;
  subcategoryName: string;
  categoryRequest: string;
};

export class BrandCategoryError extends Error {
  constructor(
    public code: 'CATEGORY_REQUIRED' | 'INVALID_CATEGORY' | 'INVALID_SUBCATEGORY',
    message: string,
  ) {
    super(message);
  }
}

/**
 * For brand save routes: when a request sends any picker field (categoryId,
 * subcategoryId, categoryRequest), validate the combined choice and return the
 * body with the canonical category fields. A new main category without a
 * subcategory clears the old subcategory (it belonged to the previous main).
 * Bodies without picker fields pass through unchanged (older clients).
 */
export async function withResolvedBrandCategory<T extends Record<string, unknown>>(
  body: T,
  existing?: { categoryId?: string; subcategoryId?: string; categoryRequest?: string } | null,
): Promise<T> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  if (!has('categoryId') && !has('subcategoryId') && !has('categoryRequest')) return body;
  const categoryId = has('categoryId') ? String(body.categoryId ?? '') : existing?.categoryId;
  const mainChanged = has('categoryId') && categoryId !== existing?.categoryId;
  const resolved = await resolveBrandCategoryChoice({
    categoryId,
    subcategoryId: has('subcategoryId') ? String(body.subcategoryId ?? '') : mainChanged ? '' : existing?.subcategoryId,
    categoryRequest: has('categoryRequest') ? String(body.categoryRequest ?? '') : existing?.categoryRequest,
  });
  return { ...body, ...resolved };
}

export async function resolveBrandCategoryChoice(choice: BrandCategoryChoice): Promise<ResolvedBrandCategory> {
  const categoryId = String(choice.categoryId || '').trim();
  if (!categoryId) throw new BrandCategoryError('CATEGORY_REQUIRED', 'Choose the brand category');
  const categories = await catalogStore.listCategories();
  const main = categories.find((c) => c.id === categoryId);
  if (!main || main.parentId || main.enabled === false) {
    throw new BrandCategoryError('INVALID_CATEGORY', 'Choose a main category from the list');
  }
  const subcategoryId = String(choice.subcategoryId || '').trim();
  let subcategoryName = '';
  if (subcategoryId) {
    const sub = categories.find((c) => c.id === subcategoryId);
    if (!sub || sub.parentId !== main.id || sub.enabled === false) {
      throw new BrandCategoryError('INVALID_SUBCATEGORY', `That subcategory is not under ${main.name}`);
    }
    subcategoryName = sub.name;
  }
  return {
    category: main.name,
    categoryId: main.id,
    subcategoryId,
    subcategoryName,
    categoryRequest: String(choice.categoryRequest || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
}
