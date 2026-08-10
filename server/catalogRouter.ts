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
import { authenticateRequest, softAuthenticateRequest } from './middleware/auth';
import { requireAnyPermission } from './middleware/authorization';
import { requireBrandStudioWrite } from './middleware/brandStudioAuth';
import { requireCreatorStudioWrite } from './middleware/creatorStudioAuth';
import { hasPermission, hasRole } from './permissions/authorization';
import { PERMISSIONS } from './permissions/permissions';
import { ROLES } from './permissions/roles';
import { draftStore, type DraftEntityType } from '../lib/vercel-catalog/draftStore';
import type { CatalogProduct } from '../src/types/catalog';
import type { CatalogBrand } from '../src/types/catalog';
import type { Request, Response } from 'express';
import {
  brandIsMarketplaceVisible,
  ensureCreatorWorkspace,
  ensureSellerBrandWorkspace,
  listOwnedProducts,
  listSellerCustomersFromOrders,
} from './catalog/sellerWorkspace';
import { sellerOwnsBrand } from './catalog/brandOwnership';
import {
  assertProductLifecycleTransition,
  brandAllowsProductPublish,
  isProductPubliclyEligible,
  normalizeProductLifecycle,
  ProductLifecycleError,
  toPersistedProductStatus,
} from './catalog/productLifecycle';
import {
  adjustInventory,
  ensureInventoryRecord,
  getInventoryRecord,
  InventoryValidationError,
  listInventoryForProduct,
  syncProductStockFromInventory,
} from './catalog/inventoryStore';
import {
  getService,
  listServices,
  normalizeServiceInput,
  upsertService,
  deleteService as deleteServiceRecord,
} from './catalog/serviceStore';
import {
  assertCategoryDeletable,
  assertCategoryHierarchy,
  CategorySchemaError,
  deleteAttribute,
  getAttribute,
  getCategorySchema,
  invalidateCategorySchemaCache,
  listAttributesForCategory,
  normalizeAttributeInput,
  upsertAttribute,
} from './catalog/categorySchemaStore';
import {
  attributesFromSpecs,
  validateListingAgainstCategorySchema,
} from './catalog/categorySchemaValidation';
import { publishEvent } from './events/eventBus';
import { operationsStore } from './operations/operationsStore';
import { getCatalogPersistenceMode } from '../lib/vercel-catalog/catalogStore';

export const catalogRouter = Router();

const requireAuth = [authenticateRequest];
/** Platform admin (ADMIN inherits via ROLE_INHERITANCE; SUPER_ADMIN too). */
const requireCmsWrite = [authenticateRequest, requireAnyPermission([PERMISSIONS.CMS_EDIT])];
/** Admin-only category tree + attribute schema (IS-003 §52). */
const requireCategoryManage = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.CATEGORY_MANAGE]),
];
const requireAttributeManage = [
  authenticateRequest,
  requireAnyPermission([PERMISSIONS.ATTRIBUTE_MANAGE]),
];
/** Brand Studio profile writes: cms:edit OR owning seller. */
const requireBrandStudioBrandWrite = [authenticateRequest, requireBrandStudioWrite];
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

function userIsCreatorRole(req: {
  userRole?: (typeof ROLES)[keyof typeof ROLES];
}): boolean {
  const role = req.userRole;
  if (!role) return false;
  return hasRole(role, ROLES.CREATOR);
}

/**
 * Sellers may edit Brand Studio profile fields only.
 * Marketplace Access / verification / claim / ownership / featured flags stay
 * locked without cms:edit. Marketplace Access mutations require the admin-only
 * PATCH .../marketplace-access endpoint.
 */
function preserveBrandPrivilegedFieldsOnUpdate(
  req: Request,
  existing: CatalogBrand,
  normalized: CatalogBrand,
): CatalogBrand {
  if (hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return normalized;
  }
  return {
    ...normalized,
    sellerId: existing.sellerId,
    verifiedStatus: existing.verifiedStatus,
    claimStatus: existing.claimStatus,
    featuredFlag: existing.featuredFlag,
    sponsoredFlag: existing.sponsoredFlag,
    followers: existing.followers,
    ratings: existing.ratings,
    // Marketplace Access is platform-admin only — never accept seller/creator writes.
    marketplaceStatus: existing.marketplaceStatus,
    marketplaceAccess: existing.marketplaceAccess,
  };
}

/** Reject Seller/Creator attempts to mutate Marketplace Access via brand PATCH/PUT. */
function rejectUnauthorizedMarketplaceAccessMutation(
  req: Request,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  _existing: CatalogBrand,
): boolean {
  if (hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return false;
  }
  const body = (req.body || {}) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(body, 'marketplaceAccess')
    || Object.prototype.hasOwnProperty.call(body, 'marketplaceStatus')) {
    res.status(403).json({
      error: 'Marketplace Access can only be changed by platform administrators',
    });
    return true;
  }
  return false;
}

async function scopeBrandsForRequest(req: Request, brands: CatalogBrand[]): Promise<CatalogBrand[]> {
  if (userIsPlatformAdmin(req) || hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return brands;
  }
  if (userIsSellerRole(req) && req.userId) {
    return brands.filter((b) => b.sellerId === req.userId);
  }
  return brands.filter(brandIsMarketplaceVisible);
}

async function scopeProductsForRequest(req: Request, products: CatalogProduct[]) {
  if (userIsPlatformAdmin(req) || hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return products;
  }
  if (userIsSellerRole(req) && req.userId) {
    return products.filter((p) => p.sellerId === req.userId);
  }
  const brands = await catalogStore.listBrands();
  const brandById = new Map(brands.map((b) => [b.id, b]));
  return products.filter((p) => isProductPubliclyEligible(p, brandById.get(p.brandId)));
}

async function scopeCreatorsForRequest(req: Request, creators: Awaited<ReturnType<typeof catalogStore.listCreators>>) {
  if (userIsPlatformAdmin(req) || hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return creators;
  }
  if (userIsCreatorRole(req) && req.userId) {
    return creators.filter((c) => c.userId === req.userId);
  }
  return creators.filter((c) => c.status === 'live');
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

/** Sellers must own the TARGET brand when brandId changes (or on create). */
async function assertSellerOwnsTargetBrand(
  req: Request,
  res: Response,
  brandId: string,
): Promise<boolean> {
  if (userIsPlatformAdmin(req)) return true;
  if (!userIsSellerRole(req) || !req.userId) return true;
  if (!brandId || !(await sellerOwnsBrand(req.userId, brandId))) {
    res.status(403).json({
      error: 'Products must belong to a brand you own. Open Brand Studio or claim a brand first.',
    });
    return false;
  }
  return true;
}

async function enforceProductLifecycleAndPublish(
  req: Request,
  existing: CatalogProduct | undefined,
  next: CatalogProduct,
): Promise<CatalogProduct> {
  if (existing) {
    assertProductLifecycleTransition(
      existing.status,
      next.status,
      userIsPlatformAdmin(req) ? 'admin' : 'seller',
    );
  }

  const nextLifecycle = normalizeProductLifecycle(next.status);
  const prevLifecycle = existing ? normalizeProductLifecycle(existing.status) : 'draft';
  const becomingActive = nextLifecycle === 'active' && prevLifecycle !== 'active';

  if (becomingActive) {
    const brand = (await catalogStore.listBrands()).find((b) => b.id === next.brandId);
    if (!brandAllowsProductPublish(brand)) {
      throw new ProductLifecycleError(
        'Cannot publish product while Brand Marketplace Access is not granted',
      );
    }
  }

  // Always persist Active as legacy `live`.
  return { ...next, status: toPersistedProductStatus(nextLifecycle) as CatalogProduct['status'] };
}

function emitProductEvent(
  eventName: string,
  req: Request,
  product: CatalogProduct,
  extra: Record<string, unknown> = {},
) {
  publishEvent({
    eventName,
    domain: 'Catalog',
    producer: 'catalogRouter',
    aggregateId: product.id,
    actor: req.userId || 'anonymous',
    payload: {
      productId: product.id,
      brandId: product.brandId,
      sellerId: product.sellerId,
      status: product.status,
      lifecycle: normalizeProductLifecycle(product.status),
      ...extra,
    },
  });
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
  const productType = typeof query.productType === 'string' ? query.productType : '';

  return products.filter((product) => {
    if (q) {
      const haystack = `${product.title} ${product.description} ${product.brandName} ${product.categoryName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (status) {
      const want = normalizeProductLifecycle(status);
      const have = normalizeProductLifecycle(product.status);
      // Accept live/active interchangeably for filters.
      if (want !== have) return false;
    }
    if (modeType && product.modeType !== modeType) return false;
    if (productType && (product.productType || 'physical') !== productType) return false;
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

catalogRouter.get('/catalog/snapshot', softAuthenticateRequest, async (req, res) => {
  try {
    const [productsRaw, categories, brandsRaw, deals, homepage] = await Promise.all([
      catalogStore.listProducts(),
      catalogStore.listCategories(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
      catalogStore.getHomepage(),
    ]);
    const [products, brands] = await Promise.all([
      scopeProductsForRequest(req, productsRaw),
      scopeBrandsForRequest(req, brandsRaw),
    ]);

    res.json({ products, categories, brands, deals, homepage });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load snapshot' });
  }
});

catalogRouter.get('/catalog/home', softAuthenticateRequest, async (req, res) => {
  try {
    const [homepage, productsRaw, brandsRaw, deals, creatorsRaw, guides] = await Promise.all([
      catalogStore.getHomepage(),
      catalogStore.listProducts(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
      catalogStore.listCreators(),
      catalogStore.listGuides(),
    ]);
    const [products, brands, creators] = await Promise.all([
      scopeProductsForRequest(req, productsRaw),
      scopeBrandsForRequest(req, brandsRaw),
      scopeCreatorsForRequest(req, creatorsRaw),
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

catalogRouter.get('/catalog/products', softAuthenticateRequest, async (req, res) => {
  try {
    const productsRaw = await catalogStore.listProducts();
    const products = await scopeProductsForRequest(req, productsRaw);
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
  softAuthenticateRequest,
  validate({ params: CatalogProductParamsSchema }),
  async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const scoped = await scopeProductsForRequest(req, [product]);
    if (!scoped.length) {
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
    let normalized = stampSellerOwnershipOnCreate(
      req,
      normalizeProductInput(req.body, undefined, context),
    );
    if (!(await assertSellerOwnsTargetBrand(req, res, normalized.brandId))) return;
    normalized = await enforceProductLifecycleAndPublish(req, undefined, normalized);
    try {
      await validateListingAgainstCategorySchema({
        categoryId: normalized.categoryId,
        status: normalized.status,
        attributes: normalized.attributes,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    // New products default to draft unless explicitly transitioning with eligibility.
    if (
      !userIsPlatformAdmin(req) &&
      normalizeProductLifecycle(normalized.status) === 'active' &&
      normalizeProductLifecycle((req.body as { status?: string })?.status || 'draft') === 'active'
    ) {
      // already validated in enforceProductLifecycleAndPublish
    }
    const saved = await catalogStore.upsertProduct(normalized);
    await ensureInventoryRecord({
      productId: saved.id,
      quantity: Math.max(0, saved.stock),
      sku: typeof (req.body as { sku?: string })?.sku === 'string' ? (req.body as { sku: string }).sku : undefined,
    });
    await syncProductStockFromInventory(saved.id);
    emitProductEvent('ProductCreated', req, saved);
    if (normalizeProductLifecycle(saved.status) === 'active') {
      emitProductEvent('ProductPublished', req, saved);
    }
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.put('/catalog/products/:id', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    let normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...req.body, id: req.params.id }, existing, context),
    );
    if (normalized.brandId !== existing.brandId) {
      if (!(await assertSellerOwnsTargetBrand(req, res, normalized.brandId))) return;
    }
    normalized = await enforceProductLifecycleAndPublish(req, existing, normalized);
    try {
      await validateListingAgainstCategorySchema({
        categoryId: normalized.categoryId,
        status: normalized.status,
        attributes: normalized.attributes,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await catalogStore.upsertProduct(normalized);
    await ensureInventoryRecord({ productId: saved.id, quantity: Math.max(0, saved.stock) });
    await syncProductStockFromInventory(saved.id);
    emitProductEvent('ProductUpdated', req, saved);
    if (
      normalizeProductLifecycle(existing.status) !== 'active' &&
      normalizeProductLifecycle(saved.status) === 'active'
    ) {
      emitProductEvent('ProductPublished', req, saved);
    }
    if (normalizeProductLifecycle(saved.status) === 'archived') {
      emitProductEvent('ProductArchived', req, saved);
    }
    if (normalizeProductLifecycle(saved.status) === 'suspended') {
      emitProductEvent('ProductSuspended', req, saved);
    }
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product payload') });
  }
});

catalogRouter.patch('/catalog/products/:id', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    const context = await buildProductNormalizeContext(req.params.id);
    let normalized = preserveProductOwnershipOnUpdate(
      req,
      existing,
      normalizeProductInput({ ...existing, ...req.body, id: req.params.id }, existing, context),
    );
    if (normalized.brandId !== existing.brandId) {
      if (!(await assertSellerOwnsTargetBrand(req, res, normalized.brandId))) return;
    }
    normalized = await enforceProductLifecycleAndPublish(req, existing, normalized);
    try {
      await validateListingAgainstCategorySchema({
        categoryId: normalized.categoryId,
        status: normalized.status,
        attributes: normalized.attributes,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await catalogStore.upsertProduct(normalized);
    if (typeof (req.body as { stock?: number })?.stock === 'number') {
      await ensureInventoryRecord({ productId: saved.id, quantity: Math.max(0, saved.stock) });
      await syncProductStockFromInventory(saved.id);
    }
    emitProductEvent('ProductUpdated', req, saved);
    if (
      normalizeProductLifecycle(existing.status) !== 'active' &&
      normalizeProductLifecycle(saved.status) === 'active'
    ) {
      emitProductEvent('ProductPublished', req, saved);
    }
    if (
      normalizeProductLifecycle(existing.status) === 'archived' &&
      normalizeProductLifecycle(saved.status) === 'active'
    ) {
      emitProductEvent('ProductRestored', req, saved);
    }
    if (normalizeProductLifecycle(saved.status) === 'archived') {
      emitProductEvent('ProductArchived', req, saved);
    }
    if (normalizeProductLifecycle(saved.status) === 'suspended') {
      emitProductEvent('ProductSuspended', req, saved);
    }
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid product patch payload') });
  }
});

catalogRouter.delete('/catalog/products/:id', ...requireProductDelete, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    await catalogStore.deleteProduct(req.params.id);
    emitProductEvent('ProductDeleted', req, existing);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete product' });
  }
});

catalogRouter.post('/catalog/products/:id/archive', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    assertProductLifecycleTransition(existing.status, 'archived', userIsPlatformAdmin(req) ? 'admin' : 'seller');
    const saved = await catalogStore.upsertProduct({
      ...existing,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    });
    emitProductEvent('ProductArchived', req, saved);
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to archive product' });
  }
});

catalogRouter.post('/catalog/products/:id/restore', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, existing)) return;
    assertProductLifecycleTransition(existing.status, 'active', userIsPlatformAdmin(req) ? 'admin' : 'seller');
    const brand = (await catalogStore.listBrands()).find((b) => b.id === existing.brandId);
    if (!brandAllowsProductPublish(brand)) {
      res.status(400).json({
        error: 'Cannot restore product to Active while Brand Marketplace Access is not granted',
      });
      return;
    }
    const saved = await catalogStore.upsertProduct({
      ...existing,
      status: toPersistedProductStatus('active') as CatalogProduct['status'],
      updatedAt: new Date().toISOString(),
    });
    emitProductEvent('ProductRestored', req, saved);
    emitProductEvent('ProductPublished', req, saved);
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to restore product' });
  }
});

catalogRouter.get('/catalog/products/:id/inventory', ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;
    const variantId = typeof req.query.variantId === 'string' ? req.query.variantId : undefined;
    let record = await getInventoryRecord(product.id, variantId);
    if (!record && !variantId) {
      record = await ensureInventoryRecord({ productId: product.id, quantity: Math.max(0, product.stock) });
    }
    if (!record) {
      res.status(404).json({ error: 'Inventory record not found' });
      return;
    }
    res.json({ success: true, data: record, records: await listInventoryForProduct(product.id) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load inventory' });
  }
});

catalogRouter.patch('/catalog/products/:id/inventory', ...requireProductEdit, async (req, res) => {
  try {
    const product = await catalogStore.getProduct(req.params.id);
    if (!forbidUnlessOwnsProduct(req, res, product)) return;

    const body = (req.body ?? {}) as {
      variantId?: string;
      quantity?: number;
      delta?: number;
      reservedQuantity?: number;
      sku?: string;
      lowStockThreshold?: number;
      warehouseId?: string | null;
    };

    if (body.variantId) {
      const detail = await catalogStore.getProductDetail(product.id);
      const variant = detail?.productVariants?.find((v) => v.id === body.variantId);
      if (!variant) {
        res.status(400).json({ error: 'Variant does not belong to this product' });
        return;
      }
    }

    const record = await adjustInventory({
      productId: product.id,
      variantId: body.variantId,
      quantity: body.quantity,
      delta: body.delta,
      reservedQuantity: body.reservedQuantity,
      sku: body.sku,
      lowStockThreshold: body.lowStockThreshold,
      warehouseId: body.warehouseId,
      allowNegative: false,
    });

    if (body.variantId) {
      const detail = await catalogStore.getProductDetail(product.id);
      if (detail?.productVariants) {
        const productVariants = detail.productVariants.map((v) =>
          v.id === body.variantId
            ? { ...v, stock: record.availableQuantity, sku: body.sku ?? v.sku }
            : v,
        );
        await catalogStore.upsertProductDetail({
          ...detail,
          productVariants,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const savedProduct = (await syncProductStockFromInventory(product.id)) || product;

    publishEvent({
      eventName: 'InventoryChanged',
      domain: 'Inventory',
      producer: 'catalogRouter',
      aggregateId: product.id,
      actor: req.userId || 'anonymous',
      payload: {
        productId: product.id,
        variantId: body.variantId,
        quantity: record.quantity,
        availableQuantity: record.availableQuantity,
        inventoryState: record.inventoryState,
      },
    });
    if (record.inventoryState === 'low_stock') {
      publishEvent({
        eventName: 'InventoryLow',
        domain: 'Inventory',
        producer: 'catalogRouter',
        aggregateId: product.id,
        actor: req.userId || 'anonymous',
        payload: { productId: product.id, availableQuantity: record.availableQuantity },
      });
    }
    if (record.inventoryState === 'out_of_stock') {
      publishEvent({
        eventName: 'InventoryOutOfStock',
        domain: 'Inventory',
        producer: 'catalogRouter',
        aggregateId: product.id,
        actor: req.userId || 'anonymous',
        payload: { productId: product.id },
      });
    }

    res.json({ success: true, data: record, product: savedProduct });
  } catch (error) {
    if (error instanceof InventoryValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to adjust inventory' });
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

catalogRouter.get('/catalog/categories/:id', async (req, res) => {
  try {
    const category = await catalogStore.getCategory(req.params.id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json({ data: category });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get category' });
  }
});

/** Public/Seller read of category attribute + variant schema (IS-003 §54). */
catalogRouter.get('/catalog/categories/:id/attributes', async (req, res) => {
  try {
    const category = await catalogStore.getCategory(req.params.id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const attributes = await listAttributesForCategory(req.params.id, {
      includeArchived: req.query.includeArchived === 'true',
    });
    res.json({
      data: attributes,
      meta: {
        categoryId: category.id,
        variantDimensions: attributes.filter((a) => a.variantEligible),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list attributes' });
  }
});

catalogRouter.get('/catalog/categories/:id/schema', async (req, res) => {
  try {
    const schema = await getCategorySchema(req.params.id);
    if (!schema) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json({ data: schema });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get category schema' });
  }
});

catalogRouter.post('/catalog/categories/:id/attributes', ...requireAttributeManage, async (req, res) => {
  try {
    const normalized = normalizeAttributeInput(req.body, req.params.id);
    const saved = await upsertAttribute(normalized);
    publishEvent({
      eventName: 'AttributeCreated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { attributeId: saved.id, categoryId: saved.categoryId, key: saved.key },
    });
    publishEvent({
      eventName: 'CategorySchemaUpdated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.categoryId,
      actor: req.userId || 'anonymous',
      payload: { categoryId: saved.categoryId, change: 'attribute_created', attributeId: saved.id },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof CategorySchemaError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid attribute payload' });
  }
});

catalogRouter.patch(
  '/catalog/categories/:categoryId/attributes/:attributeId',
  ...requireAttributeManage,
  async (req, res) => {
    try {
      const existing = await getAttribute(req.params.attributeId);
      if (!existing || existing.categoryId !== req.params.categoryId) {
        res.status(404).json({ error: 'Attribute not found' });
        return;
      }
      const normalized = normalizeAttributeInput(
        { ...existing, ...req.body, id: existing.id },
        req.params.categoryId,
        existing,
      );
      const saved = await upsertAttribute(normalized);
      publishEvent({
        eventName: 'AttributeUpdated',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: saved.id,
        actor: req.userId || 'anonymous',
        payload: { attributeId: saved.id, categoryId: saved.categoryId, key: saved.key },
      });
      publishEvent({
        eventName: 'CategorySchemaUpdated',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: saved.categoryId,
        actor: req.userId || 'anonymous',
        payload: { categoryId: saved.categoryId, change: 'attribute_updated', attributeId: saved.id },
      });
      res.json({ success: true, data: saved });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid attribute patch' });
    }
  },
);

catalogRouter.delete(
  '/catalog/categories/:categoryId/attributes/:attributeId',
  ...requireAttributeManage,
  async (req, res) => {
    try {
      const existing = await getAttribute(req.params.attributeId);
      if (!existing || existing.categoryId !== req.params.categoryId) {
        res.status(404).json({ error: 'Attribute not found' });
        return;
      }
      await deleteAttribute(existing.id);
      publishEvent({
        eventName: 'AttributeRemoved',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: existing.id,
        actor: req.userId || 'anonymous',
        payload: { attributeId: existing.id, categoryId: existing.categoryId, key: existing.key },
      });
      publishEvent({
        eventName: 'CategorySchemaUpdated',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: existing.categoryId,
        actor: req.userId || 'anonymous',
        payload: {
          categoryId: existing.categoryId,
          change: 'attribute_removed',
          attributeId: existing.id,
        },
      });
      res.json({ success: true });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete attribute' });
    }
  },
);

/* ─── Service catalog foundation (Sprint 3; no booking engine) ─── */

async function scopeServicesForRequest(
  req: Request,
  rows: Awaited<ReturnType<typeof listServices>>,
) {
  if (userIsPlatformAdmin(req) || hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)) {
    return rows;
  }
  if (userIsSellerRole(req) && req.userId) {
    return rows.filter((s) => s.sellerId === req.userId);
  }
  const brands = await catalogStore.listBrands();
  const brandById = new Map(brands.map((b) => [b.id, b]));
  return rows.filter((s) => {
    const brand = brandById.get(s.brandId);
    if (!brand || !brandIsMarketplaceVisible(brand)) return false;
    const lifecycle = normalizeProductLifecycle(s.status);
    return lifecycle === 'active' || lifecycle === 'out_of_stock';
  });
}

catalogRouter.get('/catalog/persistence-mode', (_req, res) => {
  res.json({
    mode: getCatalogPersistenceMode(),
    note:
      getCatalogPersistenceMode() === 'firestore-admin'
        ? 'Production-safe Firestore catalog persistence'
        : 'Dev memory adapter with disk snapshot under .data/catalog-memory-snapshot.json',
  });
});

catalogRouter.get('/catalog/services', softAuthenticateRequest, async (req, res) => {
  try {
    const all = await scopeServicesForRequest(req, await listServices());
    const brandId = typeof req.query.brandId === 'string' ? req.query.brandId : '';
    const filtered = brandId ? all.filter((s) => s.brandId === brandId) : all;
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset);
    res.json({
      data: filtered.slice(offset, offset + limit),
      meta: { total: filtered.length, limit, offset },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list services' });
  }
});

catalogRouter.get('/catalog/services/:id', softAuthenticateRequest, async (req, res) => {
  try {
    const service = await getService(req.params.id);
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    const scoped = await scopeServicesForRequest(req, [service]);
    if (!scoped.length) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get service' });
  }
});

catalogRouter.post('/catalog/services', ...requireProductCreate, async (req, res) => {
  try {
    const existingSlugs = (await listServices()).map((s) => s.slug);
    let normalized = normalizeServiceInput(req.body, undefined, { existingSlugs });
    if (userIsSellerRole(req) && req.userId && !userIsPlatformAdmin(req)) {
      normalized = { ...normalized, sellerId: req.userId };
      if (!(await assertSellerOwnsTargetBrand(req, res, normalized.brandId))) return;
    }
    if (normalizeProductLifecycle(normalized.status) === 'active') {
      const brand = (await catalogStore.listBrands()).find((b) => b.id === normalized.brandId);
      if (!brandAllowsProductPublish(brand)) {
        res.status(400).json({
          error: 'Cannot publish service while Brand Marketplace Access is not granted',
        });
        return;
      }
    }
    const brands = await catalogStore.listBrands();
    const brand = brands.find((b) => b.id === normalized.brandId);
    if (brand) normalized = { ...normalized, brandName: brand.name };
    try {
      await validateListingAgainstCategorySchema({
        categoryId: normalized.categoryId,
        status: normalized.status,
        attributes: normalized.attributes,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await upsertService(normalized);
    publishEvent({
      eventName: 'ServiceCreated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { serviceId: saved.id, brandId: saved.brandId, sellerId: saved.sellerId },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid service payload' });
  }
});

catalogRouter.patch('/catalog/services/:id', ...requireProductEdit, async (req, res) => {
  try {
    const existing = await getService(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    if (!userIsPlatformAdmin(req)) {
      if (!req.userId || !userIsSellerRole(req) || existing.sellerId !== req.userId) {
        res.status(403).json({ error: 'Not authorized to modify this service' });
        return;
      }
    }
    const existingSlugs = (await listServices())
      .filter((s) => s.id !== existing.id)
      .map((s) => s.slug);
    let normalized = normalizeServiceInput({ ...existing, ...req.body, id: existing.id }, existing, {
      existingSlugs,
    });
    if (!userIsPlatformAdmin(req)) {
      normalized = { ...normalized, sellerId: existing.sellerId };
    }
    if (normalized.brandId !== existing.brandId) {
      if (!(await assertSellerOwnsTargetBrand(req, res, normalized.brandId))) return;
    }
    if (
      normalizeProductLifecycle(existing.status) !== normalizeProductLifecycle(normalized.status)
    ) {
      assertProductLifecycleTransition(
        existing.status,
        normalized.status,
        userIsPlatformAdmin(req) ? 'admin' : 'seller',
      );
    }
    if (
      normalizeProductLifecycle(normalized.status) === 'active' &&
      normalizeProductLifecycle(existing.status) !== 'active'
    ) {
      const brand = (await catalogStore.listBrands()).find((b) => b.id === normalized.brandId);
      if (!brandAllowsProductPublish(brand)) {
        res.status(400).json({
          error: 'Cannot publish service while Brand Marketplace Access is not granted',
        });
        return;
      }
    }
    normalized = {
      ...normalized,
      status: toPersistedProductStatus(
        normalizeProductLifecycle(normalized.status),
      ) as typeof normalized.status,
    };
    try {
      await validateListingAgainstCategorySchema({
        categoryId: normalized.categoryId,
        status: normalized.status,
        attributes: normalized.attributes,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await upsertService(normalized);
    publishEvent({
      eventName: 'ServiceUpdated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { serviceId: saved.id, brandId: saved.brandId, status: saved.status },
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof ProductLifecycleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid service patch' });
  }
});

catalogRouter.delete('/catalog/services/:id', ...requireProductDelete, async (req, res) => {
  try {
    const existing = await getService(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    if (!userIsPlatformAdmin(req)) {
      if (!req.userId || !userIsSellerRole(req) || existing.sellerId !== req.userId) {
        res.status(403).json({ error: 'Not authorized to delete this service' });
        return;
      }
    }
    await deleteServiceRecord(existing.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete service' });
  }
});

catalogRouter.post('/catalog/categories', ...requireCategoryManage, async (req, res) => {
  try {
    const normalized = normalizeCategoryInput(req.body);
    await assertCategoryHierarchy(normalized);
    const saved = await catalogStore.upsertCategory(normalized);
    invalidateCategorySchemaCache(saved.id);
    publishEvent({
      eventName: 'CategoryCreated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { categoryId: saved.id, parentId: saved.parentId, slug: saved.slug },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof CategorySchemaError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category payload') });
  }
});

catalogRouter.put('/catalog/categories/:id', ...requireCategoryManage, async (req, res) => {
  try {
    const existing = await catalogStore.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const normalized = normalizeCategoryInput({ ...req.body, id: req.params.id }, existing);
    await assertCategoryHierarchy(normalized);
    const saved = await catalogStore.upsertCategory(normalized);
    invalidateCategorySchemaCache(saved.id);
    publishEvent({
      eventName: 'CategoryUpdated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { categoryId: saved.id, parentId: saved.parentId, enabled: saved.enabled },
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof CategorySchemaError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category payload') });
  }
});

catalogRouter.patch('/catalog/categories/:id', ...requireCategoryManage, async (req, res) => {
  try {
    const existing = await catalogStore.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const normalized = normalizeCategoryInput({ ...existing, ...req.body, id: req.params.id }, existing);
    await assertCategoryHierarchy(normalized);
    const saved = await catalogStore.upsertCategory(normalized);
    invalidateCategorySchemaCache(saved.id);
    const archived = existing.enabled && !saved.enabled;
    publishEvent({
      eventName: archived ? 'CategoryArchived' : 'CategoryUpdated',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'anonymous',
      payload: { categoryId: saved.id, parentId: saved.parentId, enabled: saved.enabled },
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof CategorySchemaError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid category patch payload') });
  }
});

catalogRouter.delete('/catalog/categories/:id', ...requireCategoryManage, async (req, res) => {
  try {
    const existing = await catalogStore.getCategory(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    await assertCategoryDeletable(req.params.id);
    const attrs = await listAttributesForCategory(req.params.id, {
      includeArchived: true,
      bypassCache: true,
    });
    await Promise.all(attrs.map((a) => deleteAttribute(a.id)));
    await catalogStore.deleteCategory(req.params.id);
    invalidateCategorySchemaCache(req.params.id);
    publishEvent({
      eventName: 'CategoryArchived',
      domain: 'Catalog',
      producer: 'catalogRouter',
      aggregateId: req.params.id,
      actor: req.userId || 'anonymous',
      payload: { categoryId: req.params.id, deleted: true },
    });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof CategorySchemaError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete category' });
  }
});

catalogRouter.get('/catalog/brands', softAuthenticateRequest, async (req, res) => {
  try {
    const brands = await scopeBrandsForRequest(req, await catalogStore.listBrands());
    res.json({ data: brands });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list brands' });
  }
});

/** Seller Brand Studio boot: return owned brands only (never auto-create, never seeded Walton/etc.). */
catalogRouter.post('/catalog/workspace/seller/ensure', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId || (!userIsSellerRole(req) && !userIsPlatformAdmin(req))) {
      res.status(403).json({ error: 'Seller authentication required' });
      return;
    }
    if (userIsPlatformAdmin(req) && !userIsSellerRole(req)) {
      const brands = await catalogStore.listBrands();
      const products = await catalogStore.listProducts();
      res.json({ brands, products, customers: [], created: false });
      return;
    }
    const { brands, created } = await ensureSellerBrandWorkspace(req.userId!);
    const products = await listOwnedProducts(req.userId!);
    const customers = listSellerCustomersFromOrders(req.userId!);
    res.json({ brands, products, customers, created });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to ensure seller workspace',
    });
  }
});

/** Creator Studio boot: own profile only (auto-create draft if missing). */
catalogRouter.post('/catalog/workspace/creator/ensure', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId || (!userIsCreatorRole(req) && !userIsPlatformAdmin(req))) {
      res.status(403).json({ error: 'Creator authentication required' });
      return;
    }
    if (userIsPlatformAdmin(req) && !userIsCreatorRole(req)) {
      const creators = await catalogStore.listCreators();
      res.json({ creators, created: false });
      return;
    }
    const displayName =
      req.user?.displayName ||
      (typeof req.body?.displayName === 'string' ? req.body.displayName : undefined);
    const email =
      req.user?.email ||
      (typeof req.body?.email === 'string' ? req.body.email : undefined);
    const { creators, created } = await ensureCreatorWorkspace(req.userId!, {
      displayName,
      email,
    });
    res.json({ creators, created });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to ensure creator workspace',
    });
  }
});

catalogRouter.get('/catalog/workspace/seller/customers', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (userIsPlatformAdmin(req)) {
      res.json({ data: listSellerCustomersFromOrders(typeof req.query.sellerId === 'string' ? req.query.sellerId : req.userId) });
      return;
    }
    if (!userIsSellerRole(req)) {
      res.status(403).json({ error: 'Seller authentication required' });
      return;
    }
    res.json({ data: listSellerCustomersFromOrders(req.userId) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list customers' });
  }
});

catalogRouter.post('/catalog/brands', ...requireBrandStudioBrandWrite, async (req, res) => {
  try {
    const context = await buildBrandNormalizeContext();
    const payload =
      userIsSellerRole(req) &&
      req.userId &&
      !hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)
        ? {
            ...req.body,
            sellerId: req.userId,
            // New Seller brands start without Marketplace Access — Admin grants later.
            marketplaceAccess: false,
            marketplaceStatus: 'not_granted',
            claimStatus: req.body?.claimStatus || 'pending',
            verifiedStatus: false,
          }
        : req.body;
    const normalized = normalizeBrandInput(payload, undefined, context);
    const saved = await catalogStore.upsertBrand(normalized);
    publishEvent({
      eventName: 'BrandCreated',
      domain: 'Marketplace',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'system',
      payload: { brandId: saved.id, sellerId: saved.sellerId },
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand payload') });
  }
});

catalogRouter.put('/catalog/brands/:id', ...requireBrandStudioBrandWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    if (rejectUnauthorizedMarketplaceAccessMutation(req, res, existing)) {
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = preserveBrandPrivilegedFieldsOnUpdate(
      req,
      existing,
      normalizeBrandInput({ ...req.body, id: req.params.id }, existing, context),
    );
    const saved = await catalogStore.upsertBrand(normalized);
    publishEvent({
      eventName: 'BrandUpdated',
      domain: 'Marketplace',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'system',
      payload: { brandId: saved.id },
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand payload') });
  }
});

catalogRouter.patch('/catalog/brands/:id', ...requireBrandStudioBrandWrite, async (req, res) => {
  try {
    const existing = await catalogStore.getBrand(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    if (rejectUnauthorizedMarketplaceAccessMutation(req, res, existing)) {
      return;
    }
    const context = await buildBrandNormalizeContext(req.params.id);
    const normalized = preserveBrandPrivilegedFieldsOnUpdate(
      req,
      existing,
      normalizeBrandInput({ ...existing, ...req.body, id: req.params.id }, existing, context),
    );
    const saved = await catalogStore.upsertBrand(normalized);
    publishEvent({
      eventName: 'BrandUpdated',
      domain: 'Marketplace',
      producer: 'catalogRouter',
      aggregateId: saved.id,
      actor: req.userId || 'system',
      payload: { brandId: saved.id },
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid brand patch payload') });
  }
});

/**
 * Admin-only Marketplace Access lifecycle transition (ES-005). Controls public
 * visibility only — never ownership/editing (Seller keeps full Brand Studio
 * access regardless of status). Sellers/Creators cannot change Marketplace
 * Access via brand PATCH or this endpoint (requires cms:edit).
 */
catalogRouter.patch(
  '/catalog/brands/:id/marketplace-access',
  ...requireCmsWrite,
  async (req, res) => {
    try {
      const existing = await catalogStore.getBrand(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Brand not found' });
        return;
      }
      const status = req.body?.status;
      const validStatuses = ['not_granted', 'granted', 'restricted', 'suspended', 'restored', 'revoked'];
      if (typeof status !== 'string' || !validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
        return;
      }

      let activeOrderWarning: string | null = null;
      if ((status === 'suspended' || status === 'revoked' || status === 'restricted') && existing.sellerId) {
        const activeOrders = operationsStore
          .listOrders({ sellerId: existing.sellerId })
          .filter((order) => !['completed', 'cancelled'].includes(order.status.toLowerCase()));
        if (activeOrders.length > 0) {
          activeOrderWarning = `This seller has ${activeOrders.length} active order(s)/booking(s) in progress. They will remain fulfillable after this change, but confirm before proceeding.`;
        }
      }

      const context = await buildBrandNormalizeContext(req.params.id);
      const normalized = normalizeBrandInput(
        {
          ...existing,
          marketplaceStatus: status,
          marketplaceAccess: status === 'granted' || status === 'restored',
        },
        existing,
        context,
      );
      const saved = await catalogStore.upsertBrand(normalized);

      const eventByStatus: Record<string, string> = {
        granted: 'MarketplaceEnabled',
        restricted: 'MarketplaceRestricted',
        suspended: 'MarketplaceSuspended',
        restored: 'MarketplaceRestored',
        revoked: 'MarketplaceRevoked',
      };
      const eventName = eventByStatus[status];
      if (eventName) {
        publishEvent({
          eventName,
          domain: 'Marketplace',
          producer: 'catalogRouter',
          aggregateId: saved.id,
          actor: req.userId || 'system',
          payload: { brandId: saved.id, status },
        });
      }

      res.json({ success: true, data: saved, warning: activeOrderWarning });
    } catch (error) {
      res.status(400).json({ error: validationErrorMessage(error, 'Invalid marketplace access transition') });
    }
  },
);

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

catalogRouter.get('/catalog/creators', softAuthenticateRequest, async (req, res) => {
  try {
    const creators = await scopeCreatorsForRequest(req, await catalogStore.listCreators());
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered = status ? creators.filter((c) => c.status === status) : creators;
    res.json({ data: filtered });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list creators' });
  }
});

const requireCreatorStudioWriteMw = [authenticateRequest, requireCreatorStudioWrite];

catalogRouter.put('/catalog/creators/:id', ...requireCreatorStudioWriteMw, async (req, res) => {
  try {
    const existing = await catalogStore.getCreator(req.params.id);
    const payload =
      userIsCreatorRole(req) &&
      req.userId &&
      !hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)
        ? { ...req.body, userId: existing?.userId || req.userId }
        : req.body;
    const normalized = normalizeCreatorInput({ ...payload, id: req.params.id }, existing || undefined);
    const saved = await catalogStore.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid creator payload') });
  }
});

catalogRouter.patch('/catalog/creators/:id', ...requireCreatorStudioWriteMw, async (req, res) => {
  try {
    const existing = await catalogStore.getCreator(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }
    const payload =
      userIsCreatorRole(req) &&
      req.userId &&
      !hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)
        ? { ...req.body, userId: existing.userId }
        : req.body;
    const normalized = normalizeCreatorInput({ ...existing, ...payload, id: req.params.id }, existing);
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
    try {
      const attrs =
        (product?.attributes as Record<string, unknown> | undefined) ||
        attributesFromSpecs(normalized.specs, product?.attributes);
      await validateListingAgainstCategorySchema({
        categoryId: product!.categoryId,
        status: product!.status,
        attributes: attrs,
        optionGroups: normalized.optionGroups,
        productVariants: normalized.productVariants,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await catalogStore.upsertProductDetail(normalized);
    const prevIds = new Set((existing?.productVariants ?? []).map((v) => v.id));
    for (const variant of saved.productVariants ?? []) {
      if (!prevIds.has(variant.id)) {
        publishEvent({
          eventName: 'VariantCreated',
          domain: 'Catalog',
          producer: 'catalogRouter',
          aggregateId: product.id,
          actor: req.userId || 'anonymous',
          payload: { productId: product.id, variantId: variant.id, sku: variant.sku },
        });
        if (typeof variant.stock === 'number') {
          await ensureInventoryRecord({
            productId: product.id,
            variantId: variant.id,
            sku: variant.sku,
            quantity: Math.max(0, variant.stock),
          });
        }
      } else {
        publishEvent({
          eventName: 'VariantUpdated',
          domain: 'Catalog',
          producer: 'catalogRouter',
          aggregateId: product.id,
          actor: req.userId || 'anonymous',
          payload: { productId: product.id, variantId: variant.id, sku: variant.sku },
        });
      }
    }
    await syncProductStockFromInventory(product.id);
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
    try {
      const attrs =
        (product?.attributes as Record<string, unknown> | undefined) ||
        attributesFromSpecs(normalized.specs, product?.attributes);
      await validateListingAgainstCategorySchema({
        categoryId: product!.categoryId,
        status: product!.status,
        attributes: attrs,
        optionGroups: normalized.optionGroups,
        productVariants: normalized.productVariants,
      });
    } catch (error) {
      if (error instanceof CategorySchemaError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
    const saved = await catalogStore.upsertProductDetail(normalized);
    const prevIds = new Set((existing.productVariants ?? []).map((v) => v.id));
    for (const variant of saved.productVariants ?? []) {
      publishEvent({
        eventName: prevIds.has(variant.id) ? 'VariantUpdated' : 'VariantCreated',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: product.id,
        actor: req.userId || 'anonymous',
        payload: { productId: product.id, variantId: variant.id, sku: variant.sku },
      });
    }
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
