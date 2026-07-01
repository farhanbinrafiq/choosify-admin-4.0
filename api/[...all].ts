import express from 'express';
import { catalogRouter } from '../server/catalogRouter';
import { ensureCatalogSeedData } from '../server/catalogStore';

const app = express();
let seeded = false;

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use('/api/v1', catalogRouter);

app.get('/api/admin/stats', (_req, res) => {
  res.json({
    totalUsers: 48291,
    activeUsers: 14032,
    sellers: 1847,
    creators: 342,
    products: 94520,
    revenue: 3200000,
    engagement: 12.4,
    pendingModeration: 127,
  });
});

app.post('/api/products', (req, res) => {
  res.status(201).json({
    success: true,
    message: 'Deprecated endpoint. Use /api/v1/catalog/products',
    productId: `prod_${Math.random().toString(36).substring(2, 11)}`,
    product: req.body,
  });
});

app.put('/api/products/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Deprecated endpoint. Use /api/v1/catalog/products/:id',
    productId: req.params.id,
    product: req.body,
  });
});

app.patch('/api/products/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Deprecated endpoint. Use /api/v1/catalog/products/:id',
    productId: req.params.id,
    product: req.body,
  });
});

export default async function handler(req: any, res: any) {
  if (!seeded) {
    try {
      await ensureCatalogSeedData();
    } catch (error) {
      console.warn('[Vercel API] Seed attempt failed; continuing with runtime fallback.', error);
    } finally {
      seeded = true;
    }
  }

  return app(req, res);
}
