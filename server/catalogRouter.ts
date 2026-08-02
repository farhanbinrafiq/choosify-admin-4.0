import { Router } from 'express';
import { catalogStore, defaultHomepage } from '../lib/vercel-catalog/catalogStore';
import {
  normalizeBrandInput,
  normalizeBrandPostInput,
  normalizeCategoryInput,
  normalizeDealInput,
  normalizeDealsBannerInput,
  normalizeHomepageInput,
  normalizeProductInput,
} from './catalogContract';
import {
  normalizeCreatorInput,
  normalizeGuideInput,
  normalizePlacementInput,
  normalizeProductDetailInput,
} from '../lib/vercel-catalog/catalogEditorialContract';
import { normalizeSiteInput } from '../lib/vercel-catalog/catalogContract';
import type { CatalogProduct } from '../src/types/catalog';
import { resolveDealsBannerHref } from '../lib/vercel-catalog/dealsBannerUtils';
import { uploadImageToCloudinary } from '../lib/vercel-catalog/mediaUpload';
import { recordProductView, recordSearch } from './analytics/eventHooks';
import { validateImageUploadInput } from './lib/uploadValidation';
import { validate } from './middleware/validate';
import { CatalogProductParamsSchema } from './validation/catalog/productSchemas';
import {
  EntityDraftBodySchema,
  EntityDraftParamsSchema,
  EntityVersionBodySchema,
} from './validation/catalog/draftSchemas';
import { authenticateRequest } from './middleware/auth';
import { requireAnyPermission } from './middleware/authorization';
import { hasPermission, hasRole } from './permissions/authorization';
import { PERMISSIONS } from './permissions/permissions';
import { ROLES } from './permissions/roles';
import { draftStore, type DraftEntityType } from '../lib/vercel-catalog/draftStore';
import type { Request, Response } from 'express';

export const catalogRouter = Router();

const requireAuth = [authenticateRequest];
/** Platform admin (ADMIN inherits via ROLE_INHERITANCE; SUPER_ADMIN too). */
const requireCmsWrite = [authenticateRequest, requireAnyPermission([PERMISSIONS.CMS_EDIT])];
const requireProductCreate = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_CREATE]),
];
const requireProductEdit = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT]),
];
const requireProductDelete = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_DELETE]),
];
const requireCatalogMedia = [
  authenticateRequest,
  requireAnyPermission([
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.CMS_EDIT,
  ]),
];
/** Drafts/versions: sellers editing own listings or CMS editors. */
const requireCatalogDraftWrite = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.CMS_EDIT]),
];

function userIsPlatformAdmin(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.ADMIN) || hasRole(role, ROLES.SUPER_ADMIN);
}

function userIsSellerRole(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.SELLER) || hasRole(role, ROLES.VERIFIED_SELLER);
}

/**
 * Seller-scoped product ownership. Legacy products without sellerId are admin-only
 * until an admin assigns ownership. Sellers may only mutate rows they own.
 */
function userCanMutateOwnedProduct(
  req: { userId?: string; userRole?: (typeof ROLES)[keyof typeof ROLES] },
  product: CatalogProduct,
): boolean {
  if (userIsPlatformAdmin(req)) return true;
  if (!req.userId || !userIsSellerRole(req)) return false;
  return Boolean(product.sellerId && product.sellerId === req.userId);
}

function stampSellerOwnershipOnCreate(
  req: Request,
  product: CatalogProduct,
): CatalogProduct {
  if (userIsPlatformAdmin(req)) {
    // Allow admin to set sellerId explicitly; otherwise leave unset (platform listing).
    return product;
  }
  if (userIsSellerRole(req) && req.userId) {
    return { ...product, sellerId: req.userId };
  }
  return product;
}

/** Sellers cannot reassign sellerId; admins may. */
function preserveProductOwnershipOnUpdate(
  req: Request,
  existing: CatalogProduct,
  normalized: CatalogProduct,
): CatalogProduct {
  if (userIsPlatformAdmin(req)) return normalized;
  return { ...normalized, sellerId: existing.sellerId };
}

function forbidUnlessOwnsProduct(
  req: Request,
  res: Response,
  product: CatalogProduct | null | undefined,
): product is CatalogProduct {
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return false;
  }
  if (!userCanMutateOwnedProduct(req, product)) {
    res.status(403).json({ error: 'Not authorized to modify this product' });
    return false;
  }
  return true;
}

/**
 * Draft/version writes: product drafts are seller-owned; brand/creator/guide need CMS_EDIT.
 */
async function assertCatalogDraftWriteAllowed(
  req: Request,
  res: Response,
  entityType: DraftEntityType,
  entityId: string,
): Promise<boolean> {
  if (entityType === 'product') {
    const product = await catalogStore.getProduct(entityId);
    if (!product) {
      // Draft before first publish: sellers/admins with product edit may stage a new id.
      if (userIsPlatformAdmin(req)) return true;
      if (userIsSellerRole(req) && hasPermission(req.userRole, PERMISSIONS.PRODUCT_EDIT)) {
        return true;
      }
      res.status(404).json({ error: 'Product not found' });
      return false;
    }
    if (!userCanMutateOwnedProduct(req, product)) {
      res.status(403).json({ error: 'Not authorized to modify drafts for this product' });
      return false;
    }
    return true;
  }

  if (
    userIsPlatformAdmin(req) ||
    hasPermission(req.userRole, PERMISSIONS.CMS_EDIT)
  ) {
    return true;
  }
  res.status(403).json({ error: 'Not authorized to modify this catalog draft' });
  return false;
}

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

catalogRouter.put('/catalog/home', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.post('/catalog/products', ...requireProductCreate, async (req, res) => {
  try {
    const context = await buildProductNormalizeContext();
    const normalized = stampSellerOwnershipOnCreate(
      req,
      normalizeProductInput(req.body, undefined, context),
    );
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.put('/catalog/products/:id', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...req.body, id: req.params.id }, existing, context),
    );
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.patch('/catalog/products/:id', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    const normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...existing, ...req.body, id: req.params.id }, existing, context),
    );
    const saved = await catalogStore.upsertProduct(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product patch payload') });
  }
});

catalogRouter.delete('/catalog/products/:id', ...requireProductDelete, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
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

catalogRouter.post('/catalog/categories', ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeCategoryInput(req.body);
    const saved = await catalogStore.upsertCategory(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category payload') });
  }
});

catalogRouter.put('/catalog/categories/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.patch('/catalog/categories/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.delete('/catalog/categories/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.post('/catalog/brands', ...requireCmsWrite, async (req, res) => {
  try {
    const context = await buildBrandNormalizeContext();
    const normalized = normalizeBrandInput(req.body, undefined, context);
    const saved = await catalogStore.upsertBrand(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand payload') });
  }
});

catalogRouter.put('/catalog/brands/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.patch('/catalog/brands/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.delete('/catalog/brands/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.post('/catalog/deals', ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeDealInput(req.body);
    const saved = await catalogStore.upsertDeal(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deal payload') });
  }
});

catalogRouter.put('/catalog/deals/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.patch('/catalog/deals/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.delete('/catalog/deals/:id', ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore.deleteDeal(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete deal' });
  }
});

/** Max active banners in the homepage Today's Deals horizontal carousel. */
const MAX_ACTIVE_DEALS_BANNERS = 5;

async function readHomepageWithDealsBanners() {
  const current = await catalogStore.getHomepage().catch(() => defaultHomepage());
  return normalizeHomepageInput(current, current);
}

function activeDealsBannerCount(
  banners: { id: string; isActive: boolean }[],
  excludeId?: string,
): number {
  return banners.filter((b) => b.isActive && b.id !== excludeId).length;
}

function rejectIfTooManyActiveDeals(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  banners: { id: string; isActive: boolean }[],
  next: { id: string; isActive: boolean },
): boolean {
  if (!next.isActive) return false;
  if (activeDealsBannerCount(banners, next.id) < MAX_ACTIVE_DEALS_BANNERS) return false;
  res.status(400).json({
    error: `At most ${MAX_ACTIVE_DEALS_BANNERS} active Today's Deals banners are allowed. Deactivate another first.`,
  });
  return true;
}

/** Public: active Today's Deals carousel banners in display order */
catalogRouter.get('/catalog/deals-banners', async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const activeOnly = String(req.query.active || 'true').toLowerCase() !== 'false';
    let banners = (homepage.dealsBanners || [])
      .filter((b) => (activeOnly ? b.isActive : true))
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        ...b,
        href: resolveDealsBannerHref(b),
      }));
    if (activeOnly) {
      banners = banners.slice(0, MAX_ACTIVE_DEALS_BANNERS);
    }
    res.json({ data: banners });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list deals banners' });
  }
});

catalogRouter.post('/catalog/deals-banners', ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const nextOrder =
      homepage.dealsBanners.reduce((max, b) => Math.max(max, b.order), -1) + 1;
    const banner = normalizeDealsBannerInput(
      { ...req.body, order: req.body?.order ?? nextOrder },
      homepage.dealsBanners.length,
    );
    if (!banner.image.trim()) {
      res.status(400).json({ error: 'image is required' });
      return;
    }
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = [...homepage.dealsBanners, banner].sort((a, b) => a.order - b.order);
    const saved = await catalogStore.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage),
    );
    const created = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.status(201).json({ success: true, data: { ...created, href: resolveDealsBannerHref(created) } });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deals banner payload') });
  }
});

catalogRouter.put('/catalog/deals-banners/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const existing = homepage.dealsBanners.find((b) => b.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Deals banner not found' });
      return;
    }
    const idx = homepage.dealsBanners.findIndex((b) => b.id === req.params.id);
    const banner = normalizeDealsBannerInput({ ...req.body, id: req.params.id }, idx, existing);
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = homepage.dealsBanners
      .map((b) => (b.id === banner.id ? banner : b))
      .sort((a, b) => a.order - b.order);
    const saved = await catalogStore.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage),
    );
    const updated = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.json({ success: true, data: { ...updated, href: resolveDealsBannerHref(updated) } });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deals banner payload') });
  }
});

catalogRouter.patch('/catalog/deals-banners/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    const existing = homepage.dealsBanners.find((b) => b.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Deals banner not found' });
      return;
    }
    const idx = homepage.dealsBanners.findIndex((b) => b.id === req.params.id);
    const banner = normalizeDealsBannerInput({ ...existing, ...req.body, id: req.params.id }, idx, existing);
    if (rejectIfTooManyActiveDeals(res, homepage.dealsBanners, banner)) return;
    const dealsBanners = homepage.dealsBanners
      .map((b) => (b.id === banner.id ? banner : b))
      .sort((a, b) => a.order - b.order);
    const saved = await catalogStore.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage),
    );
    const updated = saved.dealsBanners.find((b) => b.id === banner.id) || banner;
    res.json({ success: true, data: { ...updated, href: resolveDealsBannerHref(updated) } });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid deals banner patch') });
  }
});

catalogRouter.delete('/catalog/deals-banners/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const homepage = await readHomepageWithDealsBanners();
    if (!homepage.dealsBanners.some((b) => b.id === req.params.id)) {
      res.status(404).json({ error: 'Deals banner not found' });
      return;
    }
    const dealsBanners = homepage.dealsBanners.filter((b) => b.id !== req.params.id);
    await catalogStore.upsertHomepage(
      normalizeHomepageInput({ ...homepage, dealsBanners }, homepage),
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete deals banner' });
  }
});

catalogRouter.get('/catalog/site', async (_req, res) => {
  try {
    res.json({ site: await catalogStore.getSiteConfig() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load site config' });
  }
});

catalogRouter.put('/catalog/site', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getSiteConfig();
    const normalized = normalizeSiteInput(req.body, existing);
    const saved = await catalogStore.upsertSiteConfig(normalized);
    res.json({ success: true, site: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid site config payload') });
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

catalogRouter.put('/catalog/creators/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getCreator(req.params.id);
    const normalized = normalizeCreatorInput({ ...req.body, id: req.params.id }, existing || undefined);
    const saved = await catalogStore.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid creator payload') });
  }
});

catalogRouter.patch('/catalog/creators/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getCreator(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }
    const normalized = normalizeCreatorInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid creator patch payload') });
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

catalogRouter.put('/catalog/guides/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getGuide(req.params.id);
    const normalized = normalizeGuideInput({ ...req.body, id: req.params.id }, existing || undefined);
    const saved = await catalogStore.upsertGuide(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid guide payload') });
  }
});

catalogRouter.patch('/catalog/guides/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getGuide(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Guide not found' });
      return;
    }
    const normalized = normalizeGuideInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertGuide(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid guide patch payload') });
  }
});

catalogRouter.get(
  '/catalog/:entityType/:id/draft',
  ...requireAuth,
  validate({ params: EntityDraftParamsSchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params as unknown as { entityType: DraftEntityType; id: string };
      const draft = await draftStore.getDraft(entityType, id);
      res.json({ data: draft });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load draft' });
    }
  },
);

catalogRouter.put(
  '/catalog/:entityType/:id/draft',
  ...requireCatalogDraftWrite,
  validate({ params: EntityDraftParamsSchema, body: EntityDraftBodySchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params as unknown as { entityType: DraftEntityType; id: string };
      if (!(await assertCatalogDraftWriteAllowed(req, res, entityType, id))) return;
      const saved = await draftStore.upsertDraft(entityType, id, req.body.data, req.userId ?? 'unknown');
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(400).json({ error: validationErrorMessage(error, 'Invalid draft payload') });
    }
  },
);

catalogRouter.get(
  '/catalog/:entityType/:id/versions',
  ...requireAuth,
  validate({ params: EntityDraftParamsSchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params as unknown as { entityType: DraftEntityType; id: string };
      const versions = await draftStore.listVersions(entityType, id);
      res.json({ data: versions });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list versions' });
    }
  },
);

catalogRouter.post(
  '/catalog/:entityType/:id/versions',
  ...requireCatalogDraftWrite,
  validate({ params: EntityDraftParamsSchema, body: EntityVersionBodySchema }),
  async (req, res) => {
    try {
      const { entityType, id } = req.params as unknown as { entityType: DraftEntityType; id: string };
      if (!(await assertCatalogDraftWriteAllowed(req, res, entityType, id))) return;
      const version = await draftStore.createVersion(
        entityType,
        id,
        req.body.label,
        req.body.snapshot,
        req.userId ?? 'unknown',
        req.user?.displayName,
      );
      res.status(201).json({ success: true, data: version });
    } catch (error) {
      res.status(400).json({ error: validationErrorMessage(error, 'Invalid version payload') });
    }
  },
);

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

catalogRouter.put('/catalog/placements/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getPlacement(req.params.id);
    const normalized = normalizePlacementInput({ ...req.body, id: req.params.id }, existing || undefined);
    const saved = await catalogStore.upsertPlacement(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid placement payload') });
  }
});

catalogRouter.patch('/catalog/placements/:id', ...requireCmsWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getPlacement(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Placement not found' });
      return;
    }
    const normalized = normalizePlacementInput({ ...existing, ...req.body, id: req.params.id }, existing);
    const saved = await catalogStore.upsertPlacement(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid placement patch payload') });
  }
});

catalogRouter.post('/catalog/media/upload', ...requireCatalogMedia, async (req, res) => {
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

catalogRouter.put('/catalog/product-details/:productId', ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.productId);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;
    const existing = await catalogStore.getProductDetail(req.params.productId);
    const normalized = normalizeProductDetailInput(
      { ...req.body, productId: req.params.productId },
      req.params.productId,
      existing || undefined,
    );
    const saved = await catalogStore.upsertProductDetail(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product detail payload') });
  }
});

catalogRouter.patch('/catalog/product-details/:productId', ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.productId);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;
    const existing = await catalogStore.getProductDetail(req.params.productId);
    if (!existing) {
      res.status(404).json({ error: 'Product detail not found' });
      return;
    }
    const normalized = normalizeProductDetailInput(
      { ...existing, ...req.body, productId: req.params.productId },
      req.params.productId,
      existing,
    );
    const saved = await catalogStore.upsertProductDetail(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product detail patch payload') });
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

catalogRouter.post('/catalog/brand-posts', ...requireCmsWrite, async (req, res) => {
  try {
    const normalized = normalizeBrandPostInput(req.body);
    const saved = await catalogStore.upsertBrandPost(normalized);
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand post payload') });
  }
});

catalogRouter.put('/catalog/brand-posts/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.patch('/catalog/brand-posts/:id', ...requireCmsWrite, async (req, res) => {
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

catalogRouter.delete('/catalog/brand-posts/:id', ...requireCmsWrite, async (req, res) => {
  try {
    await catalogStore.deleteBrandPost(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete brand post' });
  }
});
