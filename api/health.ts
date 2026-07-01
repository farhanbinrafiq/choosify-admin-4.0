import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { handleVercelCatalogRequest } = await import('../server/vercelCatalogRouter');
  return handleVercelCatalogRequest(req, res);
}
