import { Router } from 'express';
import { catalogStore, defaultHomepage } from '../lib/vercel-catalog/catalogStore';
import {
  normalizeBrandInput,
  normalizeCategoryInput,
  normalizeDealInput,
  normalizeHomepageInput,
  normalizeProductInput,
} from './catalogContract';
import type { CatalogProduct } from '../src/types/catalog';

export const catalogRouter = Router();

const parseLimit = (value: unknown, fallback: number, max = 100): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
};

const parseOffset = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
};

const filterProducts = (products: CatalogProduct[], query: Record<string, unknown>) => {
  const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId : '';
  const brandId = typeof query.brandId === 'string' ? query.brandId : '';
  const status = typeof query.status === 'string' ? query.status : '';
  const modeType = typeof query.modeType === 'string' ? query.modeType : '';

  return products.filter((product) => {
    if (q) {
      const haystack = `${product.title} ${product.description} ${product.brandName} ${product.categoryName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (status && product.status !== status) return false;
    if (modeType && product.modeType !== modeType) return false;
    return true;
  });
};

catalogRouter.get('/catalog/snapshot', async (_req, res) => {
  try {
    const [products, categories, brands, deals, homepage] = await Promise.all([
      catalogStore.listProducts(),
      catalogStore.listCategories(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
      catalogStore.getHomepage(),
    ]);

    res.json({ products, categories, brands, deals, homepage });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load snapshot' });
  }
});

catalogRouter.get('/catalog/home', async (_req, res) => {
  try {
    const [homepage, products, brands, deals, creators, guides] = await Promise.all([
      catalogStore.getHomepage(),
      catalogStore.listProducts(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
      catalogStore.listCreators(),
      catalogStore.listGuides(),
    ]);

    res.json({
      homepage,
      featuredProducts: products.filter((item) => homepage.featuredProductIds.includes(item.id)),
      featuredBrands: brands.filter((item) => homepage.featuredBrandIds.includes(item.id)),
      featuredDeals: deals.filter((item) => homepage.featuredDealIds.includes(item.id)),
      featuredCreators: creators.filter((item) => homepage.featuredCreatorIds.includes(item.id)),
      featuredGuides: guides.filter((item) => homepage.featuredGuideIds.includes(item.id)),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load homepage config' });
  }
});

catalogRouter.put('/catalog/home', async (req, res) => {
  try {
    const current = await catalogStore.getHomepage().catch(() => defaultHomepage());
    const normalized = normalizeHomepageInput(req.body, current);
    const saved = await catalogStore.upsertHomepage(normalized);
    res.json({ success: true, homepage: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid homepage payload' });
  }
});

catalogRouter.get('/catalog/products', async (req, res) => {
  try {
    const products = await catalogStore.listProducts();
    const filtered = filterProducts(products, req.query as Record<string, unknown>);
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset);
    const data = filtered.slice(offset, offset + limit);
    res.json({
      data,
      meta: { total: filtered.length, limit, offset },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list products' });
  }
});

catalogRouter.get('/catalog/products/:id', async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get product' });
  }
});

catalogRouter.post('/catalog/products', async (req, res) => {
  try {
    const normalized = normalizeProductInput(req.body);
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product payload' });
  }
});

catalogRouter.put('/catalog/products/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const normalized = normalizeProductInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product payload' });
  }
});

catalogRouter.patch('/catalog/products/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const normalized = normalizeProductInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product patch payload' });
  }
});

catalogRouter.delete('/catalog/products/:id', async (req, res) => {
  try {
    await catalogStore.deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete product' });
  }
});

catalogRouter.get('/catalog/categories', async (_req, res) => {
  try {
    const categories = await catalogStore.listCategories();
    res.json({ data: categories });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list categories' });
  }
});

catalogRouter.post('/catalog/categories', async (req, res) => {
  try {
    const normalized = normalizeCategoryInput(req.body);
    const saved = await catalogStore.upsertCategory(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid category payload' });
  }
});

catalogRouter.put('/catalog/categories/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const normalized = normalizeCategoryInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertCategory(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid category payload' });
  }
});

catalogRouter.patch('/catalog/categories/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const normalized = normalizeCategoryInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertCategory(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid category patch payload' });
  }
});

catalogRouter.delete('/catalog/categories/:id', async (req, res) => {
  try {
    await catalogStore.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete category' });
  }
});

catalogRouter.get('/catalog/brands', async (_req, res) => {
  try {
    const brands = await catalogStore.listBrands();
    res.json({ data: brands });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list brands' });
  }
});

catalogRouter.post('/catalog/brands', async (req, res) => {
  try {
    const normalized = normalizeBrandInput(req.body);
    const saved = await catalogStore.upsertBrand(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid brand payload' });
  }
});

catalogRouter.put('/catalog/brands/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    const normalized = normalizeBrandInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid brand payload' });
  }
});

catalogRouter.patch('/catalog/brands/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    const normalized = normalizeBrandInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid brand patch payload' });
  }
});

catalogRouter.delete('/catalog/brands/:id', async (req, res) => {
  try {
    await catalogStore.deleteBrand(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete brand' });
  }
});

catalogRouter.get('/catalog/deals', async (_req, res) => {
  try {
    const deals = await catalogStore.listDeals();
    res.json({ data: deals });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list deals' });
  }
});

catalogRouter.post('/catalog/deals', async (req, res) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const saved = await catalogStore.upsertDeal(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid deal payload' });
  }
});

catalogRouter.put('/catalog/deals/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getDeal(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const normalized = normalizeDealInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertDeal(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid deal payload' });
  }
});

catalogRouter.patch('/catalog/deals/:id', async (req, res) => {
  try {
    const existing = await catalogStore.getDeal(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const normalized = normalizeDealInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertDeal(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid deal patch payload' });
  }
});

catalogRouter.delete('/catalog/deals/:id', async (req, res) => {
  try {
    await catalogStore.deleteDeal(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete deal' });
  }
});

catalogRouter.get('/catalog/site', async (_req, res) => {
  try {
    res.json({ site: await catalogStore.getSiteConfig() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load site config' });
  }
});

catalogRouter.get('/catalog/creators', async (req, res) => {
  try {
    const creators = await catalogStore.listCreators();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered = status ? creators.filter((c) => c.status === status) : creators;
    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list creators' });
  }
});

catalogRouter.get('/catalog/guides', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'live';
    const guides = (await catalogStore.listGuides()).filter((guide) => !status || guide.status === status);
    res.json({ data: guides });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list guides' });
  }
});

catalogRouter.get('/catalog/guides/:id', async (req, res) => {
  try {
    const guide = await catalogStore.getGuide(req.params.id);
    if (!guide) {
      res.status(404).json({ error: 'Guide not found' });
      return;
    }
    res.json(guide);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get guide' });
  }
});

catalogRouter.get('/catalog/placements', async (req, res) => {
  try {
    const placements = await catalogStore.listPlacements();
    const placement = typeof req.query.placement === 'string' ? req.query.placement : '';
    const activeOnly = req.query.active === 'true';
    const filtered = placements.filter((item) => {
      if (placement && item.placement !== placement) return false;
      if (activeOnly && !item.isActive) return false;
      return true;
    });
    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list placements' });
  }
});

catalogRouter.get('/catalog/product-details/:productId', async (req, res) => {
  try {
    const detail = await catalogStore.getProductDetail(req.params.productId);
    if (!detail) {
      res.status(404).json({ error: 'Product detail not found' });
      return;
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get product detail' });
  }
});
