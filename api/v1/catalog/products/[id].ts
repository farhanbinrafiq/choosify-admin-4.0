import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore } from '../../../../server/catalogMemoryStore';
import { normalizeProductInput } from '../../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../../server/vercelCatalogApi';

const getId = (req: VercelRequest) => {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw;
};

export default withCatalogApi(async (req, res) => {
  const id = getId(req);
  if (!id) {
    sendError(res, 400, 'Product id is required');
    return;
  }

  if (req.method === 'GET') {
    const product = await catalogStore.getProduct(id);
    if (!product) {
      sendError(res, 404, 'Product not found');
      return;
    }
    res.status(200).json(product);
    return;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const existing = await catalogStore.getProduct(id);
    if (!existing) {
      sendError(res, 404, 'Product not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const normalized = normalizeProductInput(
      req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id },
      existing,
    );
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(200).json({ success: true, data: saved });
    return;
  }

  if (req.method === 'DELETE') {
    await catalogStore.deleteProduct(id);
    res.status(200).json({ success: true });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
