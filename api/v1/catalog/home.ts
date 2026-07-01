import { catalogStore, defaultHomepage } from '../../../server/catalogMemoryStore';
import { normalizeHomepageInput } from '../../../server/catalogContract';
import { readJsonBody, sendError, withCatalogApi } from '../../../server/vercelCatalogApi';

export default withCatalogApi(async (req, res) => {
  if (req.method === 'GET') {
    const [homepage, products, brands, deals] = await Promise.all([
      catalogStore.getHomepage(),
      catalogStore.listProducts(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
    ]);

    res.status(200).json({
      homepage,
      featuredProducts: products.filter((item) => homepage.featuredProductIds.includes(item.id)),
      featuredBrands: brands.filter((item) => homepage.featuredBrandIds.includes(item.id)),
      featuredDeals: deals.filter((item) => homepage.featuredDealIds.includes(item.id)),
    });
    return;
  }

  if (req.method === 'PUT') {
    const current = await catalogStore.getHomepage().catch(() => defaultHomepage());
    const normalized = normalizeHomepageInput(await readJsonBody(req), current);
    const saved = await catalogStore.upsertHomepage(normalized);
    res.status(200).json({ success: true, homepage: saved });
    return;
  }

  sendError(res, 405, 'Method not allowed');
});
