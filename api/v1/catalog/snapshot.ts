import { catalogStore } from '../../../server/catalogMemoryStore';
import { withCatalogApi } from '../../../server/vercelCatalogApi';

export default withCatalogApi(async (_req, res) => {
  const [products, categories, brands, deals, homepage] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listCategories(),
    catalogStore.listBrands(),
    catalogStore.listDeals(),
    catalogStore.getHomepage(),
  ]);

  res.status(200).json({ products, categories, brands, deals, homepage });
});
