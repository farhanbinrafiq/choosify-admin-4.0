import type { VercelRequest, VercelResponse } from '@vercel/node';
import { catalogStore, defaultHomepage, ensureCatalogSeedData, getCatalogPersistenceMode } from './catalogStore';
import {
  normalizeBrandInput,
  normalizeCategoryInput,
  normalizeDealInput,
  normalizeHomepageInput,
  normalizeProductInput,
  normalizeSiteInput,
} from './catalogContract';
import {
  normalizeCreatorInput,
  normalizeGuideInput,
  normalizePlacementInput,
  normalizeProductDetailInput,
} from './catalogEditorialContract';
import type { CatalogGuide, CatalogProduct } from './catalogTypes';
import { readJsonBody, sendError, setCorsHeaders } from './catalogApiUtils';

let seeded = false;

const ensureSeeded = async () => {
  if (seeded) return;
  await ensureCatalogSeedData();
  seeded = true;
};

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

const getCatalogPath = (req: VercelRequest) => {
  const catalogPath = req.query.catalogPath;
  if (typeof catalogPath === 'string') return catalogPath.replace(/^\/+|\/+$/g, '');
  if (Array.isArray(catalogPath) && catalogPath[0]) return catalogPath[0].replace(/^\/+|\/+$/g, '');
  return '';
};

const parseRoute = (catalogPath: string) => {
  const segments = catalogPath.split('/').filter(Boolean);
  return {
    resource: segments[0] || '',
    id: segments[1] || '',
  };
};

const queryWithoutCatalogPath = (req: VercelRequest): Record<string, unknown> => {
  const query = { ...req.query } as Record<string, unknown>;
  delete query.catalogPath;
  return query;
};

async function handleProducts(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    const products = await catalogStore.listProducts();
    const filtered = filterProducts(products, queryWithoutCatalogPath(req));
    const limit = parseLimit(req.query?.limit, 100);
    const offset = parseOffset(req.query?.offset);
    res.status(200).json({ data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } });
    return;
  }
  if (!id && req.method === 'POST') {
    const normalized = normalizeProductInput(await readJsonBody(req));
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'GET') {
    const product = await catalogStore.getProduct(id);
    if (!product) {
      sendError(res, 404, 'Product not found');
      return;
    }
    res.status(200).json(product);
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getProduct(id);
    if (!existing) {
      sendError(res, 404, 'Product not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const normalized = normalizeProductInput(
      req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id },
      existing,
    );
    const saved = await catalogStore.upsertProduct(normalized);
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteProduct(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleCategories(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    res.status(200).json({ data: await catalogStore.listCategories() });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertCategory(normalizeCategoryInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getCategory(id);
    if (!existing) {
      sendError(res, 404, 'Category not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertCategory(
      normalizeCategoryInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteCategory(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleBrands(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    res.status(200).json({ data: await catalogStore.listBrands() });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertBrand(normalizeBrandInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getBrand(id);
    if (!existing) {
      sendError(res, 404, 'Brand not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertBrand(
      normalizeBrandInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteBrand(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleDeals(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    res.status(200).json({ data: await catalogStore.listDeals() });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertDeal(normalizeDealInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getDeal(id);
    if (!existing) {
      sendError(res, 404, 'Deal not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertDeal(
      normalizeDealInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteDeal(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleHome(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const [homepage, products, brands, deals, creators, guides] = await Promise.all([
      catalogStore.getHomepage(),
      catalogStore.listProducts(),
      catalogStore.listBrands(),
      catalogStore.listDeals(),
      catalogStore.listCreators(),
      catalogStore.listGuides(),
    ]);
    res.status(200).json({
      homepage,
      featuredProducts: products.filter((item) => homepage.featuredProductIds.includes(item.id)),
      featuredBrands: brands.filter((item) => homepage.featuredBrandIds.includes(item.id)),
      featuredDeals: deals.filter((item) => homepage.featuredDealIds.includes(item.id)),
      featuredCreators: creators.filter((item) => homepage.featuredCreatorIds.includes(item.id)),
      featuredGuides: guides.filter((item) => homepage.featuredGuideIds.includes(item.id)),
    });
    return;
  }
  if (req.method === 'PUT') {
    const current = await catalogStore.getHomepage().catch(() => defaultHomepage());
    const saved = await catalogStore.upsertHomepage(normalizeHomepageInput(await readJsonBody(req), current));
    res.status(200).json({ success: true, homepage: saved });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleSite(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ site: await catalogStore.getSiteConfig() });
    return;
  }
  if (req.method === 'PUT') {
    const current = await catalogStore.getSiteConfig().catch(() => undefined);
    const saved = await catalogStore.upsertSiteConfig(normalizeSiteInput(await readJsonBody(req), current));
    res.status(200).json({ success: true, site: saved });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleSnapshot(_req: VercelRequest, res: VercelResponse) {
  const [products, categories, brands, deals, homepage, site, creators, guides, placements, productDetails] =
    await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listCategories(),
    catalogStore.listBrands(),
    catalogStore.listDeals(),
    catalogStore.getHomepage(),
    catalogStore.getSiteConfig(),
    catalogStore.listCreators(),
    catalogStore.listGuides(),
    catalogStore.listPlacements(),
    catalogStore.listProductDetails(),
  ]);
  res.status(200).json({ products, categories, brands, deals, homepage, site, creators, guides, placements, productDetails });
}

const filterLiveGuides = (guides: CatalogGuide[], query: Record<string, unknown>) => {
  const status = typeof query.status === 'string' ? query.status : 'live';
  const slug = typeof query.slug === 'string' ? query.slug.trim() : '';
  return guides.filter((guide) => {
    if (status && guide.status !== status) return false;
    if (slug && guide.slug !== slug) return false;
    return true;
  });
};

async function handleCreators(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    const creators = await catalogStore.listCreators();
    const status = typeof req.query?.status === 'string' ? req.query.status : '';
    const filtered = status ? creators.filter((c) => c.status === status) : creators;
    res.status(200).json({ data: filtered });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertCreator(normalizeCreatorInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'GET') {
    const creator = await catalogStore.getCreator(id);
    if (!creator) {
      sendError(res, 404, 'Creator not found');
      return;
    }
    res.status(200).json(creator);
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getCreator(id);
    if (!existing) {
      sendError(res, 404, 'Creator not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertCreator(
      normalizeCreatorInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteCreator(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleGuides(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    const guides = filterLiveGuides(await catalogStore.listGuides(), queryWithoutCatalogPath(req));
    res.status(200).json({ data: guides });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertGuide(normalizeGuideInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'GET') {
    const guide = await catalogStore.getGuide(id);
    if (!guide) {
      sendError(res, 404, 'Guide not found');
      return;
    }
    res.status(200).json(guide);
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getGuide(id);
    if (!existing) {
      sendError(res, 404, 'Guide not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertGuide(
      normalizeGuideInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deleteGuide(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handlePlacements(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id && req.method === 'GET') {
    const placements = await catalogStore.listPlacements();
    const query = queryWithoutCatalogPath(req);
    const placement = typeof query.placement === 'string' ? query.placement : '';
    const activeOnly = query.active === 'true';
    const filtered = placements.filter((item) => {
      if (placement && item.placement !== placement) return false;
      if (activeOnly && !item.isActive) return false;
      return true;
    });
    res.status(200).json({ data: filtered });
    return;
  }
  if (!id && req.method === 'POST') {
    const saved = await catalogStore.upsertPlacement(normalizePlacementInput(await readJsonBody(req)));
    res.status(201).json({ success: true, data: saved });
    return;
  }
  if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getPlacement(id);
    if (!existing) {
      sendError(res, 404, 'Placement not found');
      return;
    }
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertPlacement(
      normalizePlacementInput(req.method === 'PATCH' ? { ...existing, ...body, id } : { ...body, id }, existing),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (id && req.method === 'DELETE') {
    await catalogStore.deletePlacement(id);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

async function handleProductDetails(req: VercelRequest, res: VercelResponse, productId: string) {
  if (!productId && req.method === 'GET') {
    res.status(200).json({ data: await catalogStore.listProductDetails() });
    return;
  }
  if (productId && req.method === 'GET') {
    const detail = await catalogStore.getProductDetail(productId);
    if (!detail) {
      sendError(res, 404, 'Product detail not found');
      return;
    }
    res.status(200).json(detail);
    return;
  }
  if (productId && (req.method === 'PUT' || req.method === 'PATCH')) {
    const existing = await catalogStore.getProductDetail(productId);
    const body = await readJsonBody<Record<string, unknown>>(req);
    const saved = await catalogStore.upsertProductDetail(
      normalizeProductDetailInput(
        req.method === 'PATCH' ? { ...existing, ...body, productId } : { ...body, productId },
        productId,
        existing ?? undefined,
      ),
    );
    res.status(200).json({ success: true, data: saved });
    return;
  }
  if (productId && req.method === 'DELETE') {
    await catalogStore.deleteProductDetail(productId);
    res.status(200).json({ success: true });
    return;
  }
  sendError(res, 405, 'Method not allowed');
}

export async function handleVercelCatalogRequest(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const catalogPath = getCatalogPath(req);
  if (!catalogPath) {
    res.status(200).json({
      ok: true,
      service: 'choosify-catalog-api',
      persistence: getCatalogPersistenceMode(),
    });
    return;
  }

  try {
    await ensureSeeded();
    const { resource, id } = parseRoute(catalogPath);

    switch (resource) {
      case 'products':
        await handleProducts(req, res, id);
        return;
      case 'categories':
        await handleCategories(req, res, id);
        return;
      case 'brands':
        await handleBrands(req, res, id);
        return;
      case 'deals':
        await handleDeals(req, res, id);
        return;
      case 'home':
        await handleHome(req, res);
        return;
      case 'site':
        await handleSite(req, res);
        return;
      case 'creators':
        await handleCreators(req, res, id);
        return;
      case 'guides':
        await handleGuides(req, res, id);
        return;
      case 'placements':
        await handlePlacements(req, res, id);
        return;
      case 'product-details':
        await handleProductDetails(req, res, id);
        return;
      case 'snapshot':
        if (req.method === 'GET') {
          await handleSnapshot(req, res);
          return;
        }
        sendError(res, 405, 'Method not allowed');
        return;
      default:
        sendError(res, 404, `Catalog route not found: ${catalogPath}`);
    }
  } catch (error) {
    if (!res.writableEnded) {
      sendError(res, 500, error instanceof Error ? error.message : 'Unexpected server error');
    }
  }
}
