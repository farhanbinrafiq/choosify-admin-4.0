import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore } from '../../../server/catalogStore';
import { normalizeProductInput } from '../../../server/catalogContract';
import type { CatalogProduct } from '../../../src/types/catalog';
import { readJsonBody, sendError, withCatalogApi } from '../../../server/vercelCatalogApi';

const parseLimit = (value: unknown, fallback: number, max = 100): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
};

const parseOffset = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
};

const filterProducts = (products: CatalogProduct[], query: Record<string, unknown>) => {
  const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId : '';
  const brandId = typeof query.brandId === 'string' ? query.brandId : '';
  const status = typeof query.status === 'string' ? query.status : '';
  const modeType = typeof query.modeType === 'string' ? query.modeType : '';

  return products.filter((product) => {
    if (q) {
      const haystack = `${product.title} ${product.description} ${product.brandName} ${product.categoryName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (status && product.status !== status) return false;
    if (modeType && product.modeType !== modeType) return false;
    return true;
  });
};

export default withCatalogApi(async (req, res) => {
  if (req.method === 'GET') {
    const products = await catalogStore.listProducts();
    const filtered = filterProducts(products, req.query as Record<string, unknown>);
    const limit = parseLimit(req.query?.limit, 100);
    const offset = parseOffset(req.query?.offset);
    const data = filtered.slice(offset, offset + limit);
    res.status(200).json({ data, meta: { total: filtered.length, limit, offset } });
    return;
  }

  if (req.method === 'POST') {
    const normalized = normalizeProductInput(await readJsonBody(req));
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
