import type { CatalogProduct } from '../../src/types/catalog';
import type { SearchFilter, SearchSort } from './searchTypes';

export function filterProducts(products: CatalogProduct[], filter: SearchFilter): CatalogProduct[] {
  const q = filter.q?.trim().toLowerCase() || '';

  return products.filter((product) => {
    if (q) {
      const haystack =
        `${product.title} ${product.description} ${product.brandName} ${product.categoryName} ${(product.tags || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filter.categoryId && product.categoryId !== filter.categoryId) return false;
    if (filter.brandId && product.brandId !== filter.brandId) return false;
    if (filter.status && product.status !== filter.status) return false;
    if (filter.inStockOnly && product.stock <= 0) return false;
    if (filter.featuredOnly && !product.featuredFlag) return false;
    if (filter.newArrivalsOnly && !product.isNewArrival) return false;
    return true;
  });
}

export function sortProducts(products: CatalogProduct[], sort: SearchSort = 'newest'): CatalogProduct[] {
  const rows = [...products];
  if (sort === 'price_asc') return rows.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') return rows.sort((a, b) => b.price - a.price);
  if (sort === 'newest') return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows;
}
