import { catalogStore } from '../../../server/catalogMemoryStore';
import { normalizeCategoryInput } from '../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../server/vercelCatalogApi';

export default withCatalogApi(async (req, res) => {
  if (req.method === 'GET') {
    const categories = await catalogStore.listCategories();
    res.status(200).json({ data: categories });
    return;
  }

  if (req.method === 'POST') {
    const normalized = normalizeCategoryInput(await readJsonBody(req));
    const saved = await catalogStore.upsertCategory(normalized);
    res.status(201).json({ success: true, data: saved });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
