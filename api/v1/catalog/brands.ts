import { catalogStore } from '../../../server/catalogStore';
import { normalizeBrandInput } from '../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../server/vercelCatalogApi';

export default withCatalogApi(async (req, res) => {
  if (req.method === 'GET') {
    const brands = await catalogStore.listBrands();
    res.status(200).json({ data: brands });
    return;
  }

  if (req.method === 'POST') {
    const normalized = normalizeBrandInput(await readJsonBody(req));
    const saved = await catalogStore.upsertBrand(normalized);
    res.status(201).json({ success: true, data: saved });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
