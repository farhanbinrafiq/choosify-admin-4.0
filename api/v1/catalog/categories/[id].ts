import type { VercelRequest } from '@vercel/node';
import { catalogStore } from '../../../../server/catalogMemoryStore';
import { normalizeCategoryInput } from '../../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../../server/vercelCatalogApi';

const getId = (req: VercelRequest) => {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw;
};

export default withCatalogApi(async (req, res) => {
  const id = getId(req);
  if (!id) {
    sendError(res, 400, 'Category id is required');
    return;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const existing = await catalogStore.getCategory(id);
    if (!existing) {
      sendError(res, 404, 'Category not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const normalized = normalizeCategoryInput(
      req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id },
      existing,
    );
    const saved = await catalogStore.upsertCategory(normalized);
    res.status(200).json({ success: true, data: saved });
    return;
  }

  if (req.method === 'DELETE') {
    await catalogStore.deleteCategory(id);
    res.status(200).json({ success: true });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
