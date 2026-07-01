import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore } from '../server/catalogMemoryStore';
import { withCatalogApi } from '../server/vercelCatalogApi';

export default withCatalogApi(async (_req, res) => {
  const products = await catalogStore.listProducts();
  res.status(200).json({ data: products, meta: { total: products.length, limit: 100, offset: 0 } });
});
