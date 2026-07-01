import type { VercelRequest } from '@vercel/node';
import { catalogStore } from '../../../../server/catalogStore';
import { normalizeDealInput } from '../../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../../server/vercelCatalogApi';

const getId = (req: VercelRequest) => {
  const raw = req.query.id;
  return Array.isArray(raw) ? raw[0] : raw;
};

export default withCatalogApi(async (req, res) => {
  const id = getId(req);
  if (!id) {
    sendError(res, 400, 'Deal id is required');
    return;
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const existing = await catalogStore.getDeal(id);
    if (!existing) {
      sendError(res, 404, 'Deal not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const normalized = normalizeDealInput(
      req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id },
      existing,
    );
    const saved = await catalogStore.upsertDeal(normalized);
    res.status(200).json({ success: true, data: saved });
    return;
  }

  if (req.method === 'DELETE') {
    await catalogStore.deleteDeal(id);
    res.status(200).json({ success: true });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
