import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    data: [
      {
        id: 'prod-s24-ultra',
        slug: 'samsung-galaxy-s24-ultra',
        title: 'Samsung Galaxy S24 Ultra',
        price: 145000,
        status: 'live',
      },
    ],
    meta: { total: 1, limit: 100, offset: 0 },
  });
}
