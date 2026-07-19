import { Router } from 'express';
import { catalogStore, defaultHomepage } from '../lib/vercel-catalog/catalogStore';
import {
  normalizeBrandInput,
  normalizeBrandPostInput,
  normalizeCategoryInput,
  normalizeDealInput,
  normalizeHomepageInput,
  normalizeProductInput,
} from './catalogContract';
import type { CatalogBrandPost, CatalogProduct } from '../src/types/catalog';
import { uploadImageToCloudinary } from '../lib/vercel-catalog/mediaUpload';
import { recordProductView, recordSearch } from './analytics/eventHooks';
import { validateImageUploadInput } from './lib/uploadValidation';
import { validate } from './middleware/validate';
import { CatalogProductParamsSchema } from './validation/catalog/productSchemas';
import { authenticateRequest } from './middleware/auth';

export const catalogRouter = Router();

const requireAuth = [authenticateRequest];

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

async function buildProductNormalizeContext(excludeProductId?: string) {
  const [brands, categories, products] = await Promise.all([
    catalogStore.listBrands(),
    catalogStore.listCategories(),
    catalogStore.listProducts(),
  ]);
  return {
    brands,
    categories,
    existingProductSlugs: products
      .filter((product) => product.id !== excludeProductId)
      .map((product) => product.slug),
  };
}

async function buildBrandNormalizeContext(excludeBrandId?: string) {
  const brands = await catalogStore.listBrands();
  return {
    existingBrandSlugs: brands
      .filter((brand) => brand.id !== excludeBrandId)
      .map((brand) => brand.slug),
  };
}

function validationErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.map((issue) => issue.message || 'Validation failed').join('; ');
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

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

catalogRouter.put('/catalog/home', ...requireAuth, async (req, res) => {
  try {
    const current = await catalogStore.getHomepage().catch(() => defaultHomepage());
    const normalized = normalizeHomepageInput(req.body, current);
    const saved = await catalogStore.upsertHomepage(normalized);
    res.json({ success: true, homepage: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid homepage payload') });
  }
});

catalogRouter.get('/catalog/products', async (req, res) => {
  try {
    const products = await catalogStore.listProducts();
    const filtered = filterProducts(products, req.query as Record<string, unknown>);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      recordSearch(req, {
        searchQuery: q,
        source: 'catalog_products',
        metadata: { resultCount: filtered.length },
      });
    }
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

catalogRouter.get(
  '/catalog/products/:id',
  validate({ params: CatalogProductParamsSchema }),
  async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    recordProductView(req, {
      productId: product.id,
      productTitle: product.title,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      brandId: product.brandId,
      brandName: product.brandName,
      source: 'catalog_product_detail',
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get product' });
  }
  },
);

catalogRouter.post('/catalog/products', ...requireAuth, async (req, res) => {
  try {
    const context = await buildProductNormalizeContext();
    const normalized = normalizeProductInput(req.body, undefined, context);
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.put('/catalog/products/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = normalizeProductInput({ ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.patch('/catalog/products/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = normalizeProductInput({ ...existing, ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product patch payload') });
  }
});

catalogRouter.delete('/catalog/products/:id', ...requireAuth, async (req, res) => {
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

catalogRouter.post('/catalog/categories', ...requireAuth, async (req, res) => {
  try {
    const normalized = normalizeCategoryInput(req.body);
    const saved = await catalogStore.upsertCategory(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category payload') });
  }
});

catalogRouter.put('/catalog/categories/:id', ...requireAuth, async (req, res) => {
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
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category payload') });
  }
});

catalogRouter.patch('/catalog/categories/:id', ...requireAuth, async (req, res) => {
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
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category patch payload') });
  }
});

catalogRouter.delete('/catalog/categories/:id', ...requireAuth, async (req, res) => {
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

catalogRouter.post('/catalog/brands', ...requireAuth, async (req, res) => {
  try {
    const context = await buildBrandNormalizeContext();
    const normalized = normalizeBrandInput(req.body, undefined, context);
    const saved = await catalogStore.upsertBrand(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand payload') });
  }
});

catalogRouter.put('/catalog/brands/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = normalizeBrandInput({ ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand payload') });
  }
});

catalogRouter.patch('/catalog/brands/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = normalizeBrandInput({ ...existing, ...req.body, id: req.params.id }, existing, context);
    const saved = await catalogStore.upsertBrand(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand patch payload') });
  }
});

catalogRouter.delete('/catalog/brands/:id', ...requireAuth, async (req, res) => {
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

catalogRouter.post('/catalog/deals', ...requireAuth, async (req, res) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const saved = await catalogStore.upsertDeal(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deal payload') });
  }
});

catalogRouter.put('/catalog/deals/:id', ...requireAuth, async (req, res) => {
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
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deal payload') });
  }
});

catalogRouter.patch('/catalog/deals/:id', ...requireAuth, async (req, res) => {
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
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deal patch payload') });
  }
});

catalogRouter.delete('/catalog/deals/:id', ...requireAuth, async (req, res) => {
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

catalogRouter.post('/catalog/media/upload', ...requireAuth, async (req, res) => {
  try {
    const { data, mimeType, fileName } = req.body as { data?: string; mimeType?: string; fileName?: string };
    const validation = validateImageUploadInput({
      base64Data: data || '',
      mimeType,
      fileName,
    });

    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const url = await uploadImageToCloudinary({
      base64Data: data!,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
    });

    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload image' });
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

catalogRouter.get('/catalog/brand-posts', async (req, res) => {
  try {
    const posts = await catalogStore.listBrandPosts();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const brandId = typeof req.query.brandId === 'string' ? req.query.brandId : '';
    const filtered = posts.filter((post) => {
      if (status && post.status !== status) return false;
      if (slug && post.slug !== slug) return false;
      if (brandId && post.brandId !== brandId) return false;
      return true;
    });
    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list brand posts' });
  }
});

catalogRouter.get('/catalog/brand-posts/:id', async (req, res) => {
  try {
    const post = await catalogStore.getBrandPost(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Brand post not found' });
      return;
    }
    res.json({ data: post });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get brand post' });
  }
});

catalogRouter.post('/catalog/brand-posts', ...requireAuth, async (req, res) => {
  try {
    const normalized = normalizeBrandPostInput(req.body);
    const saved = await catalogStore.upsertBrandPost(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand post payload') });
  }
});

catalogRouter.put('/catalog/brand-posts/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getBrandPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand post not found' });
      return;
    }
    const normalized = normalizeBrandPostInput({ ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertBrandPost(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand post payload') });
  }
});

catalogRouter.patch('/catalog/brand-posts/:id', ...requireAuth, async (req, res) => {
  try {
    const existing = await catalogStore.getBrandPost(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand post not found' });
      return;
    }
    const normalized = normalizeBrandPostInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertBrandPost(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand post patch payload') });
  }
});

catalogRouter.delete('/catalog/brand-posts/:id', ...requireAuth, async (req, res) => {
  try {
    await catalogStore.deleteBrandPost(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete brand post' });
  }
});
