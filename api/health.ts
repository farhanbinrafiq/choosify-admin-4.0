import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVercelCatalogRequest } from './_lib/catalogRouter';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleVercelCatalogRequest(req, res);
}
