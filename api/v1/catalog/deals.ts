import { catalogStore } from '../../../server/catalogStore';
import { normalizeDealInput } from '../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../server/vercelCatalogApi';

export default withCatalogApi(async (req, res) => {
  if (req.method === 'GET') {
    const deals = await catalogStore.listDeals();
    res.status(200).json({ data: deals });
    return;
  }

  if (req.method === 'POST') {
    const normalized = normalizeDealInput(await readJsonBody(req));
    const saved = await catalogStore.upsertDeal(normalized);
    res.status(201).json({ success: true, data: saved });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
