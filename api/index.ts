import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore, ensureCatalogSeedData } from '../server/catalogStore';

let seeded = false;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!seeded) {
      await ensureCatalogSeedData();
      seeded = true;
    }
    const products = await catalogStore.listProducts();
    res.status(200).json({ data: products, meta: { total: products.length, limit: 100, offset: 0 } });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load products',
    });
  }
}
