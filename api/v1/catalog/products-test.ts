import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore, ensureCatalogSeedData } from '../../../server/catalogStore';

let seeded = false;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!seeded) {
      await ensureCatalogSeedData();
      seeded = true;
    }
    const products = await catalogStore.listProducts();
    res.status(200).json({ data: products.slice(0, 1) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'failed' });
  }
}
