import type { VercelRequest, VercelResponse } from '@vercel/node';

const products = [
  {
    id: 'prod-s24-ultra',
    slug: 'samsung-galaxy-s24-ultra',
    title: 'Samsung Galaxy S24 Ultra',
    description: 'Flagship Samsung phone with advanced camera features.',
    brandId: 'brand-samsung',
    brandName: 'Samsung',
    categoryId: 'cat-mobile',
    categoryName: 'Mobile & Phones',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
    gallery: [],
    modeType: 'retail',
    price: 145000,
    originalPrice: 155000,
    stock: 42,
    status: 'live',
    tags: ['NEW'],
    isDeal: true,
    dealType: 'flash',
    discountPercent: 6.5,
    promoCode: 'S24FLASH',
    featuredFlag: true,
    isNewArrival: true,
    isBestseller: true,
  },
];

const getPath = (req: VercelRequest) => {
  const queryPath = req.query.path;
  if (typeof queryPath === 'string') return queryPath;
  if (Array.isArray(queryPath) && queryPath[0]) return queryPath[0];
  const url = req.url || '';
  const marker = '/api/v1/catalog/';
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length).split('?')[0];
  return '';
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const path = getPath(req).replace(/^\/+|\/+$/g, '');

  if (path === 'products' && req.method === 'GET') {
    res.status(200).json({ data: products, meta: { total: products.length, limit: 100, offset: 0 } });
    return;
  }

  if (path === 'deals' && req.method === 'GET') {
    res.status(200).json({ data: [] });
    return;
  }

  res.status(404).json({ error: 'Route not found', path });
}
