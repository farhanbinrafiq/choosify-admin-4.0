import type { CatalogProduct, CatalogProductDetail } from '../../types/catalog';

export type ProductEditorStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

export type ProductEditSection =
  | 'header'
  | 'media'
  | 'pricing'
  | 'specs'
  | 'overview'
  | 'box'
  | 'addons'
  | 'delivery';

export interface ProductEditorModel {
  id: string;
  title: string;
  slug: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  image: string;
  gallery: string[];
  price: number;
  originalPrice: number;
  stock: number;
  status: ProductEditorStatus;
  rating: number;
  reviewCount: number;
  orderCount: number;
  viewCount: number;
  specs: Array<{ key: string; value: string }>;
  overviewQuality: string[];
  overviewFeatures: string[];
  overviewAudience: string[];
  overviewSupport: string[];
  bestForTags: string[];
  boxContents: string[];
  additionalSpecs: Array<{ key: string; value: string }>;
  addons: Array<{ name: string; price: string; recommended?: boolean }>;
  deliveryNote: string;
  colors: string[];
  sizes: string[];
  storageOptions: string[];
  /** Persisted option/variant data — round-tripped; must not be wiped on publish. */
  optionGroups: CatalogProductDetail['optionGroups'];
  productVariants: CatalogProductDetail['productVariants'];
  publicReviews: Array<{ id: string; author: string; rating: number; comment: string }>;
  creatorVideos: Array<{ id: string; title: string; platform: string; thumbnail: string }>;
}

export function createBlankProductModel(id = 'new'): ProductEditorModel {
  return {
    id,
    title: '',
    slug: '',
    brandId: '',
    brandName: '',
    categoryId: '',
    categoryName: '',
    description: '',
    image: '',
    gallery: [],
    price: 0,
    originalPrice: 0,
    stock: 0,
    status: 'DRAFT',
    rating: 0,
    reviewCount: 0,
    orderCount: 0,
    viewCount: 0,
    specs: [],
    overviewQuality: [],
    overviewFeatures: [],
    overviewAudience: [],
    overviewSupport: [],
    bestForTags: [],
    boxContents: [],
    additionalSpecs: [],
    addons: [],
    deliveryNote: '',
    colors: [],
    sizes: [],
    storageOptions: [],
    optionGroups: [],
    productVariants: [],
    publicReviews: [],
    creatorVideos: [],
  };
}

function bulletsFromOverview(
  blocks: CatalogProductDetail['overviewBlocks'] | undefined,
  titleMatch: RegExp,
): string[] {
  if (!Array.isArray(blocks)) return [];
  const block = blocks.find((b) => titleMatch.test(b.title || ''));
  if (!block) return [];
  if (Array.isArray(block.bullets) && block.bullets.length) return block.bullets.map(String);
  if (block.content) return [block.content];
  return [];
}

export function mapCatalogProductToEditor(
  product: CatalogProduct,
  detail?: CatalogProductDetail | null,
): ProductEditorModel {
  const blank = createBlankProductModel(product.id);
  const gallery = Array.isArray(product.gallery)
    ? product.gallery.filter(Boolean)
    : product.image
      ? [product.image]
      : [];

  const status: ProductEditorStatus =
    product.status === 'live' ? 'LIVE' : product.status === 'archived' ? 'ARCHIVED' : 'DRAFT';

  const fromDetailSpecs = Array.isArray(detail?.specs)
    ? detail!.specs.map((s) => ({ key: s.key, value: s.value }))
    : [];

  const boxContents = Array.isArray(detail?.boxContents)
    ? detail!.boxContents.map((b) => b.title || b.description || '').filter(Boolean)
    : [];

  const additionalSpecs = Array.isArray(detail?.additionalSpecs)
    ? detail!.additionalSpecs.map((s) => ({ key: s.key, value: s.value }))
    : [];

  const addons = Array.isArray(detail?.addonItems)
    ? detail!.addonItems.map((a) => ({
        name: a.title || '',
        price: typeof a.price === 'number' && a.price > 0 ? `+৳${a.price.toLocaleString()}` : '',
      }))
    : [];

  const publicReviews = Array.isArray(detail?.publicReviews)
    ? detail!.publicReviews.map((r) => ({
        id: r.id,
        author: r.reviewerName,
        rating: r.rating,
        comment: r.comment,
      }))
    : [];

  const creatorVideos = Array.isArray(detail?.creatorContent)
    ? detail!.creatorContent.map((c) => ({
        id: c.id,
        title: c.title,
        platform: c.platform,
        thumbnail: c.thumbnail || '',
      }))
    : [];

  const optionColors =
    detail?.optionGroups?.find((g) => /color/i.test(g.name))?.values || [];
  const optionSizes =
    detail?.optionGroups?.find((g) => /size/i.test(g.name))?.values || [];
  const optionStorage =
    detail?.optionGroups?.find((g) => /storage|ram/i.test(g.name))?.values || [];

  return {
    ...blank,
    id: product.id,
    title: product.title || '',
    slug: product.slug || '',
    brandId: product.brandId || '',
    brandName: product.brandName || '',
    categoryId: product.categoryId || '',
    categoryName: product.categoryName || '',
    description: product.description || detail?.about || '',
    image: product.image || gallery[0] || '',
    gallery: gallery.length ? gallery : product.image ? [product.image] : [],
    price: typeof product.price === 'number' ? product.price : Number(product.price) || 0,
    originalPrice:
      typeof product.originalPrice === 'number'
        ? product.originalPrice
        : Number(product.originalPrice) || 0,
    stock: typeof product.stock === 'number' ? product.stock : Number(product.stock) || 0,
    status,
    rating: typeof (product as unknown as { rating?: number }).rating === 'number'
      ? (product as unknown as { rating: number }).rating
      : 0,
    reviewCount: publicReviews.length,
    orderCount: 0,
    viewCount: 0,
    specs: fromDetailSpecs.length
      ? fromDetailSpecs
      : (
          [
            product.categoryName ? { key: 'Category', value: product.categoryName } : null,
            product.brandName ? { key: 'Brand', value: product.brandName } : null,
          ] as Array<{ key: string; value: string } | null>
        ).filter(Boolean) as Array<{ key: string; value: string }>,
    overviewQuality: bulletsFromOverview(detail?.overviewBlocks, /quality|material/i),
    overviewFeatures: bulletsFromOverview(detail?.overviewBlocks, /feature|benefit/i),
    overviewAudience: bulletsFromOverview(detail?.overviewBlocks, /audience|use case/i),
    overviewSupport: bulletsFromOverview(detail?.overviewBlocks, /support|assurance/i),
    bestForTags: Array.isArray(detail?.bestForTags) ? detail!.bestForTags.map(String) : [],
    boxContents,
    additionalSpecs,
    addons: addons.filter((a) => a.name),
    deliveryNote: '',
    colors: optionColors,
    sizes: optionSizes,
    storageOptions: optionStorage,
    optionGroups: Array.isArray(detail?.optionGroups) ? detail!.optionGroups : [],
    productVariants: Array.isArray(detail?.productVariants) ? detail!.productVariants : [],
    publicReviews,
    creatorVideos,
  };
}

export function editorModelToProductPatch(model: ProductEditorModel): Partial<CatalogProduct> {
  const attributes: Record<string, unknown> = {};
  for (const row of model.specs || []) {
    const key = String(row.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!key) continue;
    attributes[key] = row.value;
  }
  return {
    title: model.title,
    description: model.description,
    brandId: model.brandId || undefined,
    brandName: model.brandName || undefined,
    categoryId: model.categoryId || undefined,
    categoryName: model.categoryName || undefined,
    image: model.image || undefined,
    gallery: model.gallery.length ? model.gallery : model.image ? [model.image] : [],
    price: model.price,
    originalPrice: model.originalPrice || undefined,
    stock: model.stock,
    status: model.status === 'LIVE' ? 'live' : model.status === 'ARCHIVED' ? 'archived' : 'draft',
    attributes: Object.keys(attributes).length ? attributes : undefined,
  };
}

export function editorModelToDetailPayload(model: ProductEditorModel): Partial<CatalogProductDetail> {
  const overviewBlocks: CatalogProductDetail['overviewBlocks'] = [
    {
      id: 'quality',
      title: 'Quality & Materials',
      content: '',
      bullets: model.overviewQuality,
      enabled: model.overviewQuality.length > 0,
      sortOrder: 1,
    },
    {
      id: 'features',
      title: 'Features & Benefits',
      content: '',
      bullets: model.overviewFeatures,
      enabled: model.overviewFeatures.length > 0,
      sortOrder: 2,
    },
    {
      id: 'audience',
      title: 'Audience & Use Cases',
      content: '',
      bullets: model.overviewAudience,
      enabled: model.overviewAudience.length > 0,
      sortOrder: 3,
    },
    {
      id: 'support',
      title: 'Customer Support & Assurance',
      content: '',
      bullets: model.overviewSupport,
      enabled: model.overviewSupport.length > 0,
      sortOrder: 4,
    },
  ];

  return {
    productId: model.id,
    about: model.description || undefined,
    specs: model.specs,
    pros: [],
    cons: [],
    bestForTags: model.bestForTags,
    storeComparisonList: [],
    physicalStores: [],
    overviewBlocks,
    optionGroups: buildOptionGroupsFromModel(model),
    productVariants: model.productVariants ?? [],
    creatorContent: model.creatorVideos.map((c) => ({
      id: c.id,
      platform: c.platform,
      videoUrl: '',
      thumbnail: c.thumbnail,
      title: c.title,
    })),
    boxContents: model.boxContents.map((title, i) => ({
      id: `box-${i}`,
      title,
      isFree: true,
      enabled: true,
      sortOrder: i + 1,
    })),
    additionalSpecs: model.additionalSpecs,
    addonItems: model.addons.map((a, i) => {
      const num = Number(String(a.price).replace(/[^\d.]/g, '')) || 0;
      return { id: `addon-${i}`, title: a.name, price: num };
    }),
    publicReviews: model.publicReviews.map((r) => ({
      id: r.id,
      reviewerName: r.author,
      rating: r.rating,
      comment: r.comment,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/** Merge color/size/storage editor fields with any other preserved option groups.
 * Hardcoded Color/Size/Storage are legacy editor helpers only — category schema
 * (when defined) is the server SoT for which dimensions are allowed.
 */
function buildOptionGroupsFromModel(
  model: ProductEditorModel,
): CatalogProductDetail['optionGroups'] {
  if (
    !model.colors.length &&
    !model.sizes.length &&
    !model.storageOptions.length &&
    model.optionGroups?.length
  ) {
    return model.optionGroups;
  }
  const preserved = (model.optionGroups || []).filter(
    (g) => !/^(color|size|storage|ram)$/i.test(g.name) && !/color|size|storage|ram/i.test(g.name),
  );
  const built: CatalogProductDetail['optionGroups'] = [...preserved];
  if (model.colors.length) {
    built.push({
      id: model.optionGroups?.find((g) => /color/i.test(g.name))?.id || 'og-color',
      name: 'Color',
      displayType: 'swatch',
      values: model.colors,
    });
  }
  if (model.sizes.length) {
    built.push({
      id: model.optionGroups?.find((g) => /size/i.test(g.name))?.id || 'og-size',
      name: 'Size',
      displayType: 'pills',
      values: model.sizes,
    });
  }
  if (model.storageOptions.length) {
    built.push({
      id: model.optionGroups?.find((g) => /storage|ram/i.test(g.name))?.id || 'og-storage',
      name: 'Storage',
      displayType: 'pills',
      values: model.storageOptions,
    });
  }
  if (!built.length && model.optionGroups?.length) {
    return model.optionGroups;
  }
  return built;
}
