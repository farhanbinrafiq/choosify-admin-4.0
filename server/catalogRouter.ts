import { Router } from 'express';
import { Logger } from './lib/logger';
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
import { storeUploadedImage, storeUploadedDocument } from './media/mediaUploadService';
import { isMediaCategory, type MediaCategory } from './lib/mediaStorage';
import { recordProductView, recordSearch } from './analytics/eventHooks';
import { validateImageUploadInput, validateVideoUploadInput } from './lib/uploadValidation';
import { validate } from './middleware/validate';
import { getProductComparison, getBrandComparison } from './comparison/compareService';
import { CatalogProductParamsSchema } from './validation/catalog/productSchemas';
import {
  EntityDraftBodySchema,
  EntityDraftParamsSchema,
  EntityVersionBodySchema,
} from './validation/catalog/draftSchemas';
import { authenticateRequest, softAuthenticateRequest } from './middleware/auth';
import { requirePartnerEntitlement } from './entitlements/entitlementMiddleware';
import { requireMarketplaceAccess } from './entitlements/marketplaceAccessMiddleware';
import { requireAnyPermission } from './middleware/authorization';
import { requireBrandStudioWrite } from './middleware/brandStudioAuth';
import { requireCreatorStudioWrite } from './middleware/creatorStudioAuth';
import {
  requireGuideStudioWrite,
  creatorIdsForUser,
  primaryCreatorIdForUser,
  userOwnsGuide,
  userOwnsGuidePublisherBrand,
} from './middleware/guideStudioAuth';
import { hasPermission, hasRole } from './permissions/authorization';
import { PERMISSIONS } from './permissions/permissions';
import { ROLES } from './permissions/roles';
import { draftStore, type DraftEntityType } from '../lib/vercel-catalog/draftStore';
import type { CatalogProduct } from '../src/types/catalog';
import type { CatalogProductDetail } from '../lib/vercel-catalog/catalogEditorialTypes';
import type { CatalogBrand } from '../src/types/catalog';
import type { Request, Response } from 'express';
import {
  brandIsMarketplaceVisible,
  ensureCreatorWorkspace,
  ensureSellerBrandWorkspace,
  getMyCustomerForOwner,
  listMyCustomersForOwner,
  listOwnedProducts,
} from './catalog/sellerWorkspace';
import { sellerOwnsBrand } from './catalog/brandOwnership';
import { createReport } from './moderation/moderationService';
import { REPORT_CATEGORIES } from './moderation/moderationTypes';
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
import { validateListingAgainstCategorySchema } from './catalog/categorySchemaValidation';
import { publishEvent } from './events/eventBus';
import { operationsStore } from './operations/operationsStore';
import { getCatalogPersistenceMode } from '../lib/vercel-catalog/catalogStore';
import { stampReferenceId } from './referenceIds/stampReferenceId';
import { normalizeReferenceIdQuery } from '../shared/referenceIds/registry';

export const catalogRouter = Router();

const requireAuth = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess];
/** Platform admin (ADMIN inherits via ROLE_INHERITANCE; SUPER_ADMIN too). */
const requireCmsWrite = [authenticateRequest, requirePartnerEntitlement, requireAnyPermission([PERMISSIONS.CMS_EDIT])];
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
const requireBrandStudioBrandWrite = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess, requireBrandStudioWrite];
const requireProductCreate = [
  authenticateRequest,
  requirePartnerEntitlement,
  requireMarketplaceAccess,
  requireAnyPermission([PERMISSIONS.PRODUCT_CREATE]),
];
const requireProductEdit = [
  authenticateRequest,
  requirePartnerEntitlement,
  requireMarketplaceAccess,
  requireAnyPermission([PERMISSIONS.PRODUCT_EDIT]),
];
const requireProductDelete = [
  authenticateRequest,
  requirePartnerEntitlement,
  requireMarketplaceAccess,
  requireAnyPermission([PERMISSIONS.PRODUCT_DELETE]),
];
const requireCatalogMediaPartner = [
  requirePartnerEntitlement,
  requireMarketplaceAccess,
  requireAnyPermission([
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.CMS_EDIT,
  ]),
];

/**
 * A subset of media categories any authenticated user may upload to for
 * their own account — avatar + review-evidence photos — without holding
 * partner entitlement/marketplace-access (those gate seller/creator/admin
 * catalog content, not a consumer's own profile/review media). Ownership is
 * still enforced at write time via `uploaderId = req.userId`, matching every
 * other category's authorization boundary.
 */
const CONSUMER_UPLOAD_CATEGORIES = new Set(['users', 'reviews', 'warranty-claims']);

/**
 * Routes an authenticated request through the partner-gated chain for every
 * category except the consumer-safe ones above, which only need a valid
 * session. Both branches funnel into the same `storeUploadedImage()` —
 * there is no second upload architecture, only a narrower auth gate.
 */
function runMiddleware(
  middleware: (req: Request, res: Response, next: (err?: unknown) => void) => unknown,
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const maybePromise = middleware(req, res, done);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
      (maybePromise as Promise<unknown>).then(done).catch(done);
    }
  });
}

const requireCatalogMedia = [
  authenticateRequest,
  async (req: Request, res: Response, next: (err?: unknown) => void) => {
    const category = typeof req.body?.category === 'string' ? req.body.category : '';
    if (CONSUMER_UPLOAD_CATEGORIES.has(category)) {
      next();
      return;
    }
    for (const middleware of requireCatalogMediaPartner) {
      // eslint-disable-next-line no-await-in-loop
      await runMiddleware(middleware, req, res);
      if (res.headersSent) break;
    }
    if (!res.headersSent) next();
  },
];
/** Drafts/versions: sellers editing own listings or CMS editors. */
const requireCatalogDraftWrite = [
  authenticateRequest,
  requirePartnerEntitlement,
  requireMarketplaceAccess,
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

/** Pending partners may PATCH identity fields but cannot self-publish / self-verify. */
function stripPendingCreatorPublish(
  req: Request,
  existing: { status?: string; verifiedStatus?: boolean } | null | undefined,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!req.partnerMarketplaceLocked || userIsPlatformAdmin(req)) return payload;
  return {
    ...payload,
    status: existing?.status,
    verifiedStatus: existing?.verifiedStatus,
  };
}

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
      code: 'MARKETPLACE_ACCESS_REQUIRED',
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

/** Related-info fields a seller may own; used for the admin section lock. */
const SELLER_RELATED_INFO_KEYS = [
  'storeComparisonList',
  'relatedInfoType',
  'priceAcrossStoresEnabled',
  'whatsNearby',
  'beforeYourVisit',
  'customRelatedInfo',
  'enableStoreComparison',
  'enablePhysicalStores',
] as const;

/**
 * Ownership + section-lock enforcement for the Related Information section.
 *
 *  - Non-admin callers can NEVER write `adminPromotedStores` or flip
 *    `relatedInfoLockedByAdmin`; those always revert to the stored values.
 *  - `storeComparisonList` rows are already pinned `source: 'seller'` by the
 *    normalizer, so a seller cannot spoof `source: 'admin'`.
 *  - When the section is admin-locked, a non-admin caller may not change ANY
 *    seller-owned related-info field — the mutation is rejected (403). Unrelated
 *    section saves are unaffected because the values are unchanged.
 *
 * Admin callers are unrestricted. Mutates `normalized` in place; returns a
 * response descriptor to send, or null when the write may proceed.
 */
function enforceRelatedInfoOwnership(
  req: Request,
  existing: CatalogProductDetail | null | undefined,
  normalized: CatalogProductDetail,
): { status: number; error: string } | null {
  if (userIsPlatformAdmin(req)) return null;

  // Seller can neither own promoted rows nor change the lock.
  normalized.adminPromotedStores = existing?.adminPromotedStores;
  normalized.relatedInfoLockedByAdmin = existing?.relatedInfoLockedByAdmin;

  if (existing?.relatedInfoLockedByAdmin === true) {
    const norm = (v: unknown) => JSON.stringify(v ?? null);
    const normRec = normalized as unknown as Record<string, unknown>;
    const existRec = existing as unknown as Record<string, unknown>;
    const attempted = SELLER_RELATED_INFO_KEYS.filter((k) => norm(normRec[k]) !== norm(existRec[k]));
    if (attempted.length > 0) {
      // Roll the section back so a partial write can't land, then reject.
      for (const k of SELLER_RELATED_INFO_KEYS) {
        normRec[k] = existRec[k];
      }
      return {
        status: 403,
        error:
          'Related information for this product is currently managed by Choosify and cannot be edited.',
      };
    }
  }
  return null;
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
  const qRaw = typeof query.q === 'string' ? query.q.trim() : '';
  const q = qRaw.toLowerCase();
  const refQ = normalizeReferenceIdQuery(qRaw, 'product');
  const categoryId = typeof query.categoryId === 'string' ? query.categoryId : '';
  const brandId = typeof query.brandId === 'string' ? query.brandId : '';
  const status = typeof query.status === 'string' ? query.status : '';
  const modeType = typeof query.modeType === 'string' ? query.modeType : '';
  const productType = typeof query.productType === 'string' ? query.productType : '';

  return products.filter((product) => {
    if (q) {
      if (refQ && product.productReferenceId) {
        const canonical = normalizeReferenceIdQuery(product.productReferenceId, 'product');
        if (canonical === refQ) return true;
      }
      const haystack =
        `${product.title} ${product.description} ${product.brandName} ${product.categoryName} ${product.productReferenceId || ''} ${product.sku || ''}`.toLowerCase();
      if (!haystack.includes(q) && !(refQ && (product.productReferenceId || '').toUpperCase() === refQ)) {
        return false;
      }
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

/**
 * Product Quick Comparison — server-computed candidates (ranked + tiered
 * fallback). The client never fetches the full catalog to filter it.
 */
catalogRouter.get(
  '/catalog/products/:id/comparison',
  validate({ params: CatalogProductParamsSchema }),
  async (req, res) => {
    try {
      const result = await getProductComparison(req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ data: result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to build product comparison' });
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
    const withRef = {
      ...normalized,
      productReferenceId:
        (await stampReferenceId('product', normalized, normalized.productReferenceId)) ||
        normalized.productReferenceId,
    };
    const saved = await catalogStore.upsertProduct(withRef);
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
    const saved = await catalogStore.upsertProduct({
      ...normalized,
      productReferenceId:
        existing.productReferenceId ||
        (await stampReferenceId('product', normalized, normalized.productReferenceId)) ||
        normalized.productReferenceId,
    });
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
    let brands = await scopeBrandsForRequest(req, await catalogStore.listBrands());
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (qRaw) {
      const q = qRaw.toLowerCase();
      const refQ = normalizeReferenceIdQuery(qRaw, 'brand');
      brands = brands.filter((b) => {
        if (refQ) {
          const canonical = normalizeReferenceIdQuery(b.brandReferenceId || '', 'brand');
          if (canonical === refQ) return true;
        }
        const hay = `${b.name} ${b.category} ${b.brandReferenceId || ''} ${b.slug || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    res.json({ data: brands });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list brands' });
  }
});

/**
 * Brand Quick Comparison — server-computed candidates (ranked + tiered
 * fallback). The client never fetches the full catalog to filter it.
 */
catalogRouter.get('/catalog/brands/:id/comparison', async (req, res) => {
  try {
    const result = await getBrandComparison(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }
    res.json({ data: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to build brand comparison' });
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
    const customers = await listMyCustomersForOwner(req.userId!);
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
    const customers = await listMyCustomersForOwner(req.userId!);
    res.json({ creators, customers, created });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to ensure creator workspace',
    });
  }
});

async function resolveOwnedBrandScope(
  req: { userId?: string },
  brandIdRaw: unknown,
): Promise<{ brandId: string | null; error?: string; status?: number }> {
  if (typeof brandIdRaw !== 'string' || !brandIdRaw.trim()) {
    return { brandId: null };
  }
  const brandId = brandIdRaw.trim();
  if (!req.userId) {
    return { brandId: null, error: 'Authentication required', status: 401 };
  }
  const owns = await sellerOwnsBrand(req.userId, brandId);
  if (!owns) {
    return { brandId: null, error: 'Brand not found or not owned', status: 403 };
  }
  return { brandId };
}

catalogRouter.get('/catalog/workspace/seller/customers', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const scope = await resolveOwnedBrandScope(req, req.query.brandId);
    if (scope.error) {
      res.status(scope.status || 403).json({ error: scope.error });
      return;
    }
    if (userIsPlatformAdmin(req) && !userIsSellerRole(req)) {
      // Admin may inspect a seller scope only via authenticated identity — never arbitrary sellerId from clients.
      res.json({ data: await listMyCustomersForOwner(req.userId, { brandId: scope.brandId }) });
      return;
    }
    if (!userIsSellerRole(req)) {
      res.status(403).json({ error: 'Seller authentication required' });
      return;
    }
    res.json({ data: await listMyCustomersForOwner(req.userId, { brandId: scope.brandId }) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list customers' });
  }
});

catalogRouter.get('/catalog/workspace/seller/customers/:customerId', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!userIsSellerRole(req) && !userIsPlatformAdmin(req)) {
      res.status(403).json({ error: 'Seller authentication required' });
      return;
    }
    const scope = await resolveOwnedBrandScope(req, req.query.brandId);
    if (scope.error) {
      res.status(scope.status || 403).json({ error: scope.error });
      return;
    }
    const customer = await getMyCustomerForOwner(req.userId, req.params.customerId, {
      brandId: scope.brandId,
    });
    if (!customer) {
      res.status(403).json({ error: 'Customer not accessible' });
      return;
    }
    res.json({ data: customer });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load customer' });
  }
});

catalogRouter.post('/catalog/workspace/seller/customers/:customerId/report', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!userIsSellerRole(req)) {
      res.status(403).json({ error: 'Seller authentication required' });
      return;
    }
    const customer = await getMyCustomerForOwner(req.userId, req.params.customerId);
    if (!customer) {
      res.status(403).json({ error: 'Customer not accessible' });
      return;
    }
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const report = createReport(
      {
        category: REPORT_CATEGORIES.ABUSE,
        resourceType: 'user',
        resourceId: customer.id,
        resourceLabel: customer.name,
        reporterId: req.userId,
        reporterRole: String(req.userRole || 'seller'),
        description: description || 'Seller reported a customer violation from My Customers',
        metadata: { source: 'my_customers', choosifyUserId: customer.choosifyUserId },
      },
      req,
    );
    res.status(201).json({ data: { id: report.id, status: report.status } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit report' });
  }
});

catalogRouter.get('/catalog/workspace/creator/customers', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!userIsCreatorRole(req) && !userIsPlatformAdmin(req)) {
      res.status(403).json({ error: 'Creator authentication required' });
      return;
    }
    // Creator scope is always authenticated identity — never trust creatorId query.
    res.json({ data: await listMyCustomersForOwner(req.userId) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list customers' });
  }
});

catalogRouter.get('/catalog/workspace/creator/customers/:customerId', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!userIsCreatorRole(req) && !userIsPlatformAdmin(req)) {
      res.status(403).json({ error: 'Creator authentication required' });
      return;
    }
    const customer = await getMyCustomerForOwner(req.userId, req.params.customerId);
    if (!customer) {
      res.status(403).json({ error: 'Customer not accessible' });
      return;
    }
    res.json({ data: customer });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load customer' });
  }
});

catalogRouter.post('/catalog/workspace/creator/customers/:customerId/report', ...requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!userIsCreatorRole(req)) {
      res.status(403).json({ error: 'Creator authentication required' });
      return;
    }
    const customer = await getMyCustomerForOwner(req.userId, req.params.customerId);
    if (!customer) {
      res.status(403).json({ error: 'Customer not accessible' });
      return;
    }
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const report = createReport(
      {
        category: REPORT_CATEGORIES.ABUSE,
        resourceType: 'user',
        resourceId: customer.id,
        resourceLabel: customer.name,
        reporterId: req.userId,
        reporterRole: String(req.userRole || 'creator'),
        description: description || 'Creator reported a customer violation from My Customers',
        metadata: { source: 'my_customers', choosifyUserId: customer.choosifyUserId },
      },
      req,
    );
    res.status(201).json({ data: { id: report.id, status: report.status } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to submit report' });
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
            claimStatus: 'pending',
            verifiedStatus: false,
          }
        : req.body;
    const normalized = normalizeBrandInput(payload, undefined, context);
    const withRef = {
      ...normalized,
      brandReferenceId:
        (await stampReferenceId('brand', normalized, normalized.brandReferenceId)) ||
        normalized.brandReferenceId,
    };
    const saved = await catalogStore.upsertBrand(withRef);
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
    const withRef = {
      ...normalized,
      brandReferenceId:
        existing.brandReferenceId ||
        (await stampReferenceId('brand', normalized, normalized.brandReferenceId)) ||
        normalized.brandReferenceId,
    };
    const saved = await catalogStore.upsertBrand(withRef);
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
    const withRef = {
      ...normalized,
      brandReferenceId:
        existing.brandReferenceId ||
        (await stampReferenceId('brand', normalized, normalized.brandReferenceId)) ||
        normalized.brandReferenceId,
    };
    const saved = await catalogStore.upsertBrand(withRef);
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
  authenticateRequest,
  requirePartnerEntitlement,
  requireMarketplaceAccess,
  requireAnyPermission([PERMISSIONS.CMS_EDIT]),
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

const requireCreatorStudioWriteMw = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess, requireCreatorStudioWrite];

catalogRouter.put('/catalog/creators/:id', ...requireCreatorStudioWriteMw, async (req, res) => {
  try {
    const existing = await catalogStore.getCreator(req.params.id);
    const scoped =
      userIsCreatorRole(req) &&
      req.userId &&
      !hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)
        ? { ...req.body, userId: existing?.userId || req.userId }
        : req.body;
    const payload = stripPendingCreatorPublish(req, existing, scoped as Record<string, unknown>);
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
    const scoped =
      userIsCreatorRole(req) &&
      req.userId &&
      !hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions)
        ? { ...req.body, userId: existing.userId }
        : req.body;
    const payload = stripPendingCreatorPublish(req, existing, scoped as Record<string, unknown>);
    const normalized = normalizeCreatorInput({ ...existing, ...payload, id: req.params.id }, existing);
    const saved = await catalogStore.upsertCreator(normalized);
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid creator patch payload') });
  }
});

/**
 * Guide Studio writes — cms:edit staff OR the owning creator (server-enforced,
 * see guideStudioAuth). Guide authoring is a creator/editorial capability, not a
 * seller marketplace one, so the seller Marketplace Access gate does not apply
 * here; `requireGuideStudioWrite` is the complete authorization boundary.
 */
const requireGuideStudioWriteMw = [authenticateRequest, requireGuideStudioWrite];

const userIsGuideStaff = (req: Request): boolean =>
  !!req.userRole && hasPermission(req.userRole, PERMISSIONS.CMS_EDIT, req.permissions);

/** Keep only ids that resolve to a real catalog product / brand (order preserved). */
async function filterKnownProductIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const known = new Set((await catalogStore.listProducts()).map((p) => p.id));
  return ids.filter((id) => known.has(id));
}
async function filterKnownBrandIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const known = new Set((await catalogStore.listBrands()).map((b) => b.id));
  return ids.filter((id) => known.has(id));
}

type GuideManageRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  format?: string;
  status: string;
  image: string;
  contentReferenceId?: string;
  updatedAt: string;
  publishedAt: string;
  creatorId?: string;
  publisherType: 'creator' | 'brand';
  publisherBrandId?: string;
  publisherName?: string;
  productCount: number;
  brandCount: number;
};

const toGuideManageRow = (
  g: Awaited<ReturnType<typeof catalogStore.listGuides>>[number],
  creatorNameById: Map<string, string>,
  brandNameById: Map<string, string>,
): GuideManageRow => {
  const publisherType = g.publisherType === 'brand' ? 'brand' : 'creator';
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    type: g.type,
    format: g.format,
    status: g.status,
    image: g.image || '',
    contentReferenceId: g.contentReferenceId,
    updatedAt: g.updatedAt || '',
    publishedAt: g.publishedAt || '',
    creatorId: g.creatorId,
    publisherType,
    publisherBrandId: g.publisherBrandId,
    publisherName:
      publisherType === 'brand'
        ? g.publisherBrandId
          ? brandNameById.get(g.publisherBrandId)
          : undefined
        : g.creatorId
          ? creatorNameById.get(g.creatorId)
          : undefined,
    productCount: Array.isArray(g.productIds) ? g.productIds.length : 0,
    brandCount: Array.isArray(g.brandIds)
      ? g.brandIds.length
      : (((g.sections ?? []).find((s) => s.id === 'brands_mentioned')?.data?.brandIds as
          | unknown[]
          | undefined)?.length ?? 0),
  };
};

/**
 * Persist a Guide Studio create / edit. Lifecycle is NOT changed here — status
 * stays whatever it was (new ⇒ 'draft'); publish/archive/unpublish are dedicated
 * transitions. `creatorId` is server-authoritative for creator actors.
 */
async function persistGuideStudioWrite(
  req: Request,
  res: Response,
  opts: { patch: boolean },
): Promise<void> {
  const idParam = typeof req.params.id === 'string' ? req.params.id : '';
  const existing = idParam ? await catalogStore.getGuide(idParam) : null;
  if (opts.patch && idParam && !existing) {
    res.status(404).json({ error: 'Guide not found' });
    return;
  }

  const body: Record<string, unknown> = { ...(req.body ?? {}) };
  delete body.status; // lifecycle-only; never via ordinary save
  delete body.publishedAt;
  if (idParam) body.id = idParam;

  const isStaff = userIsGuideStaff(req);

  // ── Publisher identity (server-authoritative) ─────────────────────────────
  // Intended publisher: explicit body value, else the existing record's.
  const bodyPublisherType = typeof body.publisherType === 'string' ? body.publisherType : '';
  const bodyPublisherBrandId =
    typeof body.publisherBrandId === 'string' ? body.publisherBrandId.trim() : '';
  const intendedPublisherType: 'creator' | 'brand' =
    bodyPublisherType === 'brand' || bodyPublisherType === 'creator'
      ? bodyPublisherType
      : existing?.publisherType ?? 'creator';
  const intendedPublisherBrandId =
    bodyPublisherBrandId || existing?.publisherBrandId || '';

  if (intendedPublisherType === 'brand') {
    if (!intendedPublisherBrandId) {
      res.status(400).json({ error: 'publisherBrandId is required for a brand-authored guide' });
      return;
    }
    const brandExists = !!(await catalogStore.getBrand(intendedPublisherBrandId));
    if (!brandExists) {
      res.status(400).json({ error: 'publisherBrandId does not resolve to a real brand' });
      return;
    }
    // A non-staff writer must own/administer that brand. Never trust the client.
    if (!isStaff && !(await sellerOwnsBrand(req.userId as string, intendedPublisherBrandId))) {
      res.status(403).json({ error: 'Not authorized to publish as this brand' });
      return;
    }
    body.publisherType = 'brand';
    body.publisherBrandId = intendedPublisherBrandId;
    body.creatorId = ''; // brand-authored guides carry no creator author identity
  } else {
    body.publisherType = 'creator';
    body.publisherBrandId = '';
    if (!isStaff) {
      // Creator publisher: creatorId comes from the authenticated identity, never the client.
      let creatorId = await primaryCreatorIdForUser(req.userId as string);
      if (!creatorId) {
        const { creators } = await ensureCreatorWorkspace(req.userId as string, {});
        creatorId = creators[0]?.id ?? null;
      }
      if (!creatorId) {
        res.status(403).json({ error: 'No creator workspace for this account' });
        return;
      }
      body.creatorId = creatorId;
    } else if (existing && !('creatorId' in (req.body ?? {}))) {
      body.creatorId = existing.creatorId;
    }
  }

  const normalized = normalizeGuideInput(body, existing || undefined);
  const status = existing ? normalized.status : 'draft';

  const validProductIds = await filterKnownProductIds(normalized.productIds);
  const validBrandIds = await filterKnownBrandIds(normalized.brandIds ?? []);

  // ── Live offers: authorization (V1) ─────────────────────────────────────
  //  - Creator-authored guide → NO promotional pricing (yet).
  //  - Brand-authored guide → only on products owned/managed by the publisher
  //    brand's seller (CMS staff bypass). Any offer failing this is dropped.
  let liveOffers = normalized.liveOffers ?? [];
  if (liveOffers.length) {
    if (normalized.publisherType !== 'brand') {
      res.status(403).json({
        error: 'Creator-authored guides cannot set promotional pricing yet',
        code: 'GUIDE_OFFER_AUTHOR_NOT_ALLOWED',
      });
      return;
    }
    const pubBrand = normalized.publisherBrandId
      ? await catalogStore.getBrand(normalized.publisherBrandId)
      : null;
    const brandSellerId = pubBrand?.sellerId;
    const productById = new Map((await catalogStore.listProducts()).map((p) => [p.id, p]));
    liveOffers = liveOffers.filter((o) => {
      if (!validProductIds.includes(o.productId)) return false;
      if (isStaff) return true;
      const p = productById.get(o.productId);
      return !!p && !!brandSellerId && p.sellerId === brandSellerId;
    });
    if (!liveOffers.length && (normalized.liveOffers ?? []).length) {
      res.status(403).json({
        error: 'A brand-authored guide may only offer promotions on products it owns',
        code: 'GUIDE_OFFER_PRODUCT_NOT_OWNED',
      });
      return;
    }
  }

  // ── Winner / awards: refs must exist among the guide's discussed entities ──
  const externalIds = new Set((normalized.externalRefs ?? []).map((r) => r.id));
  const refIsPresent = (ref: { entityType: string; entityId: string }): boolean => {
    if (ref.entityType === 'product') return validProductIds.includes(ref.entityId);
    if (ref.entityType === 'brand') return validBrandIds.includes(ref.entityId);
    return externalIds.has(ref.entityId); // external_product | external_brand
  };
  const sections = (normalized.sections ?? []).map((s) => {
    if (s.id === 'brands_mentioned') {
      const prev = (s.data ?? {}) as Record<string, unknown>;
      const highlightTags = prev.highlightTags && typeof prev.highlightTags === 'object' ? prev.highlightTags : undefined;
      return { ...s, data: { brandIds: validBrandIds, ...(highlightTags ? { highlightTags } : {}) } };
    }
    if (s.id === 'winner') {
      const data = (s.data ?? {}) as Record<string, unknown>;
      const overall = data.overall as { entityType: string; entityId: string } | undefined;
      const awards = Array.isArray(data.awards)
        ? (data.awards as Array<{ id: string; label: string; ref: { entityType: string; entityId: string } }>)
        : [];
      if (overall && !refIsPresent(overall)) {
        throw new Error('Overall Winner must reference an entity already present in the guide');
      }
      const validAwards = awards.filter((a) => a.ref && refIsPresent(a.ref));
      return {
        ...s,
        data: {
          ...(overall ? { overall } : {}),
          ...(validAwards.length ? { awards: validAwards } : {}),
        },
      };
    }
    if (s.id === 'recommendations') {
      const data = (s.data ?? {}) as Record<string, unknown>;
      const picks = Array.isArray(data.picks)
        ? (data.picks as Array<{ id: string; label: string; ref: { entityType: string; entityId: string } }>)
        : [];
      const validPicks = picks.filter((p) => p.ref && refIsPresent(p.ref));
      return { ...s, data: { picks: validPicks } };
    }
    return s;
  });

  const withRef = {
    ...normalized,
    status,
    productIds: validProductIds,
    brandIds: validBrandIds,
    liveOffers: liveOffers.length ? liveOffers : undefined,
    sections: sections.length ? sections : undefined,
    contentReferenceId:
      existing?.contentReferenceId ||
      (await stampReferenceId('content', normalized, normalized.contentReferenceId)) ||
      normalized.contentReferenceId,
  };
  const saved = await catalogStore.upsertGuide(withRef);
  res.json({ success: true, data: saved });
}

async function persistGuideLifecycle(
  req: Request,
  res: Response,
  nextStatus: 'live' | 'archived' | 'draft',
): Promise<void> {
  const existing = await catalogStore.getGuide(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Guide not found' });
    return;
  }
  const normalized = normalizeGuideInput(
    { ...existing, id: req.params.id, status: nextStatus },
    existing,
    { allowStatus: true },
  );
  const saved = await catalogStore.upsertGuide({
    ...normalized,
    contentReferenceId: existing.contentReferenceId || normalized.contentReferenceId,
  });

  // Publishing a guide makes its author resolvable on the storefront: promote a
  // still-draft owning creator workspace to live so "About the Author" renders
  // canonical identity (never a fabricated stand-in).
  if (nextStatus === 'live' && saved.creatorId) {
    try {
      const creator = await catalogStore.getCreator(saved.creatorId);
      if (creator && creator.status === 'draft') {
        await catalogStore.upsertCreator(
          normalizeCreatorInput({ ...creator, status: 'live' }, creator),
        );
      }
    } catch {
      /* non-fatal — guide still publishes */
    }
  }

  res.json({ success: true, data: saved });
}

// Public: live guides only. Query `status` is intentionally ignored so drafts
// and archived content can never leak through the public endpoint.

/**
 * Read-time enrichment: resolve the publisher-brand identity for a
 * brand-authored guide so the storefront can always render "About the Brand"
 * without cross-referencing a separately-filtered public brand list. NOT
 * persisted — `normalizeGuideInput` rebuilds a fresh object and never carries it.
 */
async function withGuidePublisherBrand<T extends { publisherType?: string; publisherBrandId?: string }>(
  guides: T[],
): Promise<Array<T & { publisherBrand?: { id: string; name: string; logo?: string; slug?: string } }>> {
  const needed = guides.some((g) => g.publisherType === 'brand' && g.publisherBrandId);
  if (!needed) return guides as Array<T & { publisherBrand?: never }>;
  const brandById = new Map((await catalogStore.listBrands()).map((b) => [b.id, b]));
  return guides.map((g) => {
    if (g.publisherType === 'brand' && g.publisherBrandId) {
      const b = brandById.get(g.publisherBrandId);
      if (b) {
        return {
          ...g,
          publisherBrand: { id: b.id, name: b.name, logo: b.logo, slug: b.slug },
        };
      }
    }
    return g;
  });
}

catalogRouter.get('/catalog/guides', async (_req, res) => {
  try {
    const guides = (await catalogStore.listGuides()).filter((guide) => guide.status === 'live');
    res.json({ data: await withGuidePublisherBrand(guides) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list guides' });
  }
});

// Authenticated owned-guide management list (draft / live / archived).
// Creators → own guides only. Staff (cms:edit) → all guides.
catalogRouter.get('/catalog/guides/manage', authenticateRequest, async (req, res) => {
  try {
    if (!req.userId || !req.userRole) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const isStaff = userIsGuideStaff(req);
    const roleVal = req.userRole as (typeof ROLES)[keyof typeof ROLES];
    const isCreator = hasRole(roleVal, ROLES.CREATOR);
    const isSeller = hasRole(roleVal, ROLES.SELLER) || hasRole(roleVal, ROLES.VERIFIED_SELLER);
    if (!isStaff && !isCreator && !isSeller) {
      res.status(403).json({ error: 'Not authorized to manage guides' });
      return;
    }

    const statusQ = typeof req.query.status === 'string' ? req.query.status : 'all';
    const all = await catalogStore.listGuides();
    const creators = await catalogStore.listCreators();
    const brands = await catalogStore.listBrands();
    const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

    let guides = all;
    if (!isStaff) {
      const myCreatorIds = new Set(await creatorIdsForUser(req.userId));
      // seller → guides whose publisher brand they own
      const myBrandIds = new Set<string>();
      if (isSeller) {
        for (const b of brands) {
          if (b.sellerId === req.userId) myBrandIds.add(b.id);
        }
      }
      guides = guides.filter(
        (g) =>
          (g.creatorId && myCreatorIds.has(g.creatorId)) ||
          (g.publisherType === 'brand' && g.publisherBrandId && myBrandIds.has(g.publisherBrandId)),
      );
    }
    if (statusQ === 'draft' || statusQ === 'live' || statusQ === 'archived') {
      guides = guides.filter((g) => g.status === statusQ);
    }
    const rows = guides
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map((g) => toGuideManageRow(g, creatorNameById, brandNameById));
    const scope = isStaff ? 'staff' : isCreator ? 'creator' : 'seller';
    res.json({ data: rows, scope });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list managed guides' });
  }
});

// Single guide. Live → public. Non-live → owner or cms:edit staff only (404 to others).
catalogRouter.get('/catalog/guides/:id', softAuthenticateRequest, async (req, res) => {
  try {
    const guide = await catalogStore.getGuide(req.params.id);
    if (!guide) {
      res.status(404).json({ error: 'Guide not found' });
      return;
    }
    if (guide.status !== 'live') {
      const isStaff = userIsGuideStaff(req);
      const owns = req.userId
        ? (await userOwnsGuide(req.userId, guide)) ||
          (await userOwnsGuidePublisherBrand(req.userId, guide))
        : false;
      if (!isStaff && !owns) {
        res.status(404).json({ error: 'Guide not found' });
        return;
      }
    }
    res.json((await withGuidePublisherBrand([guide]))[0]);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get guide' });
  }
});

catalogRouter.post('/catalog/guides', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideStudioWrite(req, res, { patch: false });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid guide payload') });
  }
});

catalogRouter.put('/catalog/guides/:id', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideStudioWrite(req, res, { patch: false });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid guide payload') });
  }
});

catalogRouter.patch('/catalog/guides/:id', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideStudioWrite(req, res, { patch: true });
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Invalid guide patch payload') });
  }
});

catalogRouter.post('/catalog/guides/:id/publish', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideLifecycle(req, res, 'live');
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Failed to publish guide') });
  }
});

catalogRouter.post('/catalog/guides/:id/archive', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideLifecycle(req, res, 'archived');
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Failed to archive guide') });
  }
});

catalogRouter.post('/catalog/guides/:id/unpublish', ...requireGuideStudioWriteMw, async (req, res) => {
  try {
    await persistGuideLifecycle(req, res, 'draft');
  } catch (error) {
    res.status(400).json({ error: validationErrorMessage(error, 'Failed to unpublish guide') });
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
    const { data, mimeType, fileName, category } = req.body as {
      data?: string;
      mimeType?: string;
      fileName?: string;
      category?: string;
    };
    const resolvedCategory: MediaCategory = isMediaCategory(category) ? category : 'products';
    const uploaderId = req.userId || req.user?.uid;
    if (!uploaderId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Warranty-claim evidence is the first category to accept video, using the
    // validator that was already built for this (previously unwired — no live
    // upload surface accepted video before). Image evidence still goes through
    // the normal image pipeline (WebP re-encode + thumbnail).
    const isVideoAttempt = typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/');
    if (resolvedCategory === 'warranty-claims' && isVideoAttempt) {
      const videoValidation = validateVideoUploadInput({ base64Data: data || '', mimeType, fileName });
      if (videoValidation.ok === false) {
        res.status(400).json({ error: videoValidation.error });
        return;
      }
      const uploaded = await storeUploadedDocument({
        category: resolvedCategory,
        base64Data: data!,
        mimeType: videoValidation.mimeType,
        fileName: videoValidation.fileName,
        uploaderId,
      });
      res.json({ success: true, url: uploaded.url, mediaId: uploaded.mediaId });
      return;
    }

    // Public-category video (e.g. a product's single optional storefront video).
    // Stored as-is on the app's own media disk — no image pipeline — and served
    // from a public /media URL. The JSON body limit still applies, so only short
    // clips fit this path; larger videos must be supplied as a video link.
    if (isVideoAttempt) {
      const videoValidation = validateVideoUploadInput({ base64Data: data || '', mimeType, fileName });
      if (videoValidation.ok === false) {
        res.status(400).json({ error: videoValidation.error });
        return;
      }
      const uploaded = await storeUploadedDocument({
        category: resolvedCategory,
        base64Data: data!,
        mimeType: videoValidation.mimeType,
        fileName: videoValidation.fileName,
        uploaderId,
      });
      res.json({ success: true, url: uploaded.url, mediaId: uploaded.mediaId });
      return;
    }

    const validation = validateImageUploadInput({
      base64Data: data || '',
      mimeType,
      fileName,
    });

    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const uploaded = await storeUploadedImage({
      category: resolvedCategory,
      base64Data: data!,
      mimeType: validation.mimeType,
      fileName: validation.fileName,
      uploaderId,
    });

    res.json({ success: true, url: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl, mediaId: uploaded.mediaId });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload image' });
  }
});

/**
 * Deletes an uploaded media record + (for locally-stored files) the physical
 * file. Ownership rule: the original uploader, or a platform admin. Media
 * isn't tracked against the specific brand/product/etc. it ends up attached
 * to, so uploader identity is the authorization boundary — this matches the
 * upload-time check (any authenticated actor with catalog-media permission
 * can upload; only they, or an admin, can later delete what they uploaded).
 */
catalogRouter.delete('/catalog/media/:id', ...requireCatalogMedia, async (req, res) => {
  try {
    const { getMediaRecord, deleteMediaRecord } = await import('./media/mediaRepository');
    const { deleteMediaFile } = await import('./lib/mediaStorage');
    const record = await getMediaRecord(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }
    const actorId = req.userId || req.user?.uid;
    if (!userIsPlatformAdmin(req) && record.uploadedByUserId !== actorId) {
      res.status(403).json({ error: 'Not authorized to delete this media' });
      return;
    }
    if (record.provider === 'local' && record.relativePath) {
      await deleteMediaFile(record.relativePath, record.category as MediaCategory);
    }
    await deleteMediaRecord(record.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete media' });
  }
});

/**
 * Authenticated-only access to private documents (verification/identity/
 * seller/creator documents) — the sole way these are ever reachable. Never
 * static-mounted, never a public URL. Ownership rule matches upload/delete:
 * the original uploader, or a platform admin (who legitimately needs to
 * review claim-verification documents). Every access is audit-logged since
 * these are sensitive documents (NID, trade license, etc.).
 */
catalogRouter.get('/catalog/media/private/:id', ...requireAuth, async (req, res) => {
  try {
    const { getMediaRecord } = await import('./media/mediaRepository');
    const { resolvePrivateFilePath } = await import('./lib/mediaStorage');
    const record = await getMediaRecord(req.params.id);
    if (!record || record.visibility !== 'private') {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    const actorId = req.userId || req.user?.uid;
    let authorized = userIsPlatformAdmin(req) || record.uploadedByUserId === actorId;
    // Warranty claim evidence: the claim's seller may also view it (buyer/seller/admin
    // only, per the claim's own authorization — never a public/anonymous URL).
    if (!authorized && record.relatedEntityType === 'warranty_claim' && record.relatedEntityId && actorId) {
      const { operationsStore } = await import('./operations/operationsStore');
      const claim = operationsStore.getWarrantyClaim(record.relatedEntityId);
      if (claim && claim.sellerId === actorId) authorized = true;
    }
    if (!authorized) {
      Logger.security('private_media_access_denied', {
        requestId: req.requestId,
        mediaId: record.id,
        actorId,
      });
      res.status(403).json({ error: 'Not authorized to view this document' });
      return;
    }
    if (record.provider !== 'local' || !record.relativePath) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    Logger.audit('private_media_accessed', {
      requestId: req.requestId,
      mediaId: record.id,
      actorId,
      isAdminAccess: userIsPlatformAdmin(req) && record.uploadedByUserId !== actorId,
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolvePrivateFilePath(record.relativePath), { headers: { 'Content-Type': record.mimeType } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load document' });
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
    {
      const denied = enforceRelatedInfoOwnership(req, existing, normalized);
      if (denied) {
        res.status(denied.status).json({ error: denied.error });
        return;
      }
    }
    try {
      // Free-form `detail.specs` are presentation data and are NEVER folded into
      // category-schema validation. Only the product's own canonical
      // `product.attributes` are checked here (unchanged by a detail save).
      await validateListingAgainstCategorySchema({
        categoryId: product!.categoryId,
        status: product!.status,
        attributes: (product?.attributes as Record<string, unknown> | undefined) ?? {},
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
    // Services/bookables never get physical-stock inventory records auto-created
    // for their configurable dimensions (variants sprint services boundary).
    const usesPhysicalInventory = product.productType !== 'service';
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
        if (usesPhysicalInventory && typeof variant.stock === 'number') {
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
    if (usesPhysicalInventory) {
      await syncProductStockFromInventory(product.id);
    }
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
    {
      const denied = enforceRelatedInfoOwnership(req, existing, normalized);
      if (denied) {
        res.status(denied.status).json({ error: denied.error });
        return;
      }
    }
    try {
      // Free-form `detail.specs` are presentation data and are NEVER folded into
      // category-schema validation — only the product's own canonical
      // `product.attributes` are checked (unchanged by a detail save).
      await validateListingAgainstCategorySchema({
        categoryId: product!.categoryId,
        status: product!.status,
        attributes: (product?.attributes as Record<string, unknown> | undefined) ?? {},
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

/**
 * Admin-only management of the Related Information section's Choosify-owned
 * surface: the promoted "Where to Buy" entries and the section lock. Sellers use
 * the normal product-details endpoints for their own rows; this route never
 * touches seller-owned fields.
 *
 *   PUT /catalog/product-details/:productId/related-info/admin
 *   body: { adminPromotedStores?: RelatedStoreEntry[], relatedInfoLockedByAdmin?: boolean }
 */
catalogRouter.put(
  '/catalog/product-details/:productId/related-info/admin',
  authenticateRequest,
  async (req, res) => {
    try {
      if (!userIsPlatformAdmin(req)) {
        res.status(403).json({ error: 'Admin role required to manage promoted related information.' });
        return;
      }
      const product = await catalogStore.getProduct(req.params.productId);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const existing = await catalogStore.getProductDetail(req.params.productId);
      if (!existing) {
        res.status(404).json({ error: 'Product detail not found' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      // Re-use the shared normalizer but feed it ONLY the admin-owned keys on top
      // of the existing detail, so every seller-owned field is preserved exactly.
      const merged = normalizeProductDetailInput(
        {
          ...existing,
          ...('adminPromotedStores' in body ? { adminPromotedStores: body.adminPromotedStores } : {}),
          ...('relatedInfoLockedByAdmin' in body
            ? { relatedInfoLockedByAdmin: body.relatedInfoLockedByAdmin }
            : {}),
          productId: req.params.productId,
        },
        req.params.productId,
        existing,
      );
      const saved = await catalogStore.upsertProductDetail(merged);
      publishEvent({
        eventName: 'ProductRelatedInfoAdminUpdated',
        domain: 'Catalog',
        producer: 'catalogRouter',
        aggregateId: product.id,
        actor: req.userId || 'admin',
        payload: {
          productId: product.id,
          promotedCount: (saved.adminPromotedStores ?? []).length,
          locked: saved.relatedInfoLockedByAdmin === true,
        },
      });
      res.json({ success: true, data: saved });
    } catch (error) {
      res
        .status(400)
        .json({ error: validationErrorMessage(error, 'Invalid promoted related-info payload') });
    }
  },
);

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
