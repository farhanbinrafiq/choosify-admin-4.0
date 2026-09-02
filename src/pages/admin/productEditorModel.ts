import type { CatalogProduct, CatalogProductDetail, RelatedStoreEntry } from '../../types/catalog';

export type ProductEditorStatus = 'DRAFT' | 'LIVE' | 'ARCHIVED';

export type ProductEditSection =
  | 'header'
  | 'media'
  | 'pricing'
  | 'specs'
  | 'overview'
  | 'box'
  | 'addons'
  | 'delivery'
  | 'influencer'
  | 'warranty'
  | 'relatedinfo';

export type RelatedInfoType =
  | ''
  | 'price_across_stores'
  | 'whats_nearby'
  | 'before_your_visit'
  | 'custom';

/** One column of a seller-defined "Custom" Related Information section. */
export interface EditorCustomRelatedBlock {
  id: string;
  heading: string;
  items: string[];
}

/** Seller-editable "Where to Buy" row (canonical `RelatedStoreEntry`, seller-owned). */
export interface EditorRelatedStore {
  id: string;
  storeName: string;
  storeUrl: string;
  price: number;
  availability: string;
  storeRating: number;
  isFeatured: boolean;
  logoUrl: string;
}

export interface EditorWhatsNearby {
  restaurantCafe: string[];
  entertainmentAttraction: string[];
  hospitalPoliceStation: string[];
  transportAirport: string[];
  shoppingAtm: string[];
}

export interface EditorBeforeYourVisit {
  parkingAvailability: string;
  cancellationPolicy: string;
  whatToBring: string;
  wheelchairAccess: string;
  insuranceAccepted: string;
  /** Seller-added fields beyond the five presets. */
  customFields: Array<{ id: string; label: string; value: string }>;
}

export interface ProductEditorModel {
  id: string;
  title: string;
  slug: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  /** Optional seller-facing product code / article number (canonical `CatalogProduct.sku`). */
  sku: string;
  description: string;
  image: string;
  gallery: string[];
  /** One optional storefront product video — YouTube / direct HTTPS video / `/media/*` upload. */
  videoUrl: string;
  /** Physical products use per-variant stock/inventory; services/bookables do not. */
  productType: 'physical' | 'service';
  price: number;
  originalPrice: number;
  stock: number;
  status: ProductEditorStatus;
  rating: number;
  reviewCount: number;
  orderCount: number;
  viewCount: number;
  specs: Array<{ key: string; value: string }>;
  /**
   * Product Overview — a list of titled bullet blocks. The 4 well-known titles
   * (Quality & Materials / Features & Benefits / Audience & Use Cases / Customer
   * Support & Assurance) are seeded as presets; the seller can rename them, add
   * their own blocks, or remove ones they don't use.
   */
  overviewBlocks: Array<{ id: string; title: string; bullets: string[] }>;
  bestForTags: string[];
  boxContents: string[];
  additionalSpecs: Array<{ key: string; value: string }>;
  /**
   * Optional paid extras (distinct from variants). Carried faithfully — canonical
   * `detail.addonItems` shape, incl. the additive `enabled`/`sortOrder`/`badge`/
   * `maxQuantity` fields.
   */
  addonItems: NonNullable<CatalogProductDetail['addonItems']>;
  /** "Delivery Information" section — region + quick-service delivery facts. */
  deliveryRegion: string;
  deliveryBullets: string[];
  /**
   * "Warranty & After-Sales Services" section. Warranty fields persist on the
   * canonical CatalogProduct (and snapshot into orders); after-sales bullets
   * live on the product detail.
   */
  warrantyMonths: number;
  warrantyType: string;
  warrantyProvider: string;
  warrantyTerms: string;
  afterSalesBullets: string[];
  /**
   * Generic category-driven variant configuration — the ONLY variant carriers.
   * `optionGroups` = enabled dimensions + their permitted values; `productVariants`
   * = the generated combinations with per-combination SKU/price/MRP/stock/status/
   * media. Hardcoded Color/Size/Storage fields were removed — existing listings'
   * Color/Size/Storage groups already live here and render generically.
   */
  optionGroups: NonNullable<CatalogProductDetail['optionGroups']>;
  productVariants: NonNullable<CatalogProductDetail['productVariants']>;
  /**
   * Seller-uploaded informational Size / Measurement / Compatibility / Fitment /
   * Feature guide for this listing (shown from the Options & Variants section).
   * Presentation metadata — NEVER touches variants / price / SKU / stock /
   * availability / checkout. `undefined` ⇒ the seller has not configured one and
   * the save omits the key so any existing value is preserved server-side.
   */
  sizeGuide?: NonNullable<CatalogProductDetail['sizeGuide']>;
  publicReviews: Array<{ id: string; author: string; rating: number; comment: string }>;
  /**
   * Creator Reviews — seller-added shareable video-review links (YouTube /
   * Instagram / TikTok / Facebook) with a thumbnail. Round-trips to
   * `detail.creatorContent`; the storefront renders it with its existing logic.
   */
  creatorVideos: Array<{
    id: string;
    title: string;
    platform: string;
    thumbnail: string;
    videoUrl: string;
    creatorHandle?: string;
  }>;
  /**
   * "Related Information" section. Two independently-owned surfaces:
   *  - `relatedStores` / `whatsNearby` / `beforeYourVisit` — SELLER-owned, editable.
   *  - `adminPromotedStores` — CHOOSIFY-owned promoted rows, READ-ONLY here.
   *  - `relatedInfoLockedByAdmin` — admin section lock, READ-ONLY here; when true
   *    the whole section is presented read-only to the seller.
   * The section adapts to `relatedInfoType` (category/listing intent).
   */
  relatedInfoType: RelatedInfoType;
  priceAcrossStoresEnabled: boolean;
  relatedStores: EditorRelatedStore[];
  adminPromotedStores: RelatedStoreEntry[];
  relatedInfoLockedByAdmin: boolean;
  whatsNearby: EditorWhatsNearby;
  beforeYourVisit: EditorBeforeYourVisit;
  customRelatedInfoTitle: string;
  customRelatedBlocks: EditorCustomRelatedBlock[];
}

const EMPTY_WHATS_NEARBY = (): EditorWhatsNearby => ({
  restaurantCafe: [],
  entertainmentAttraction: [],
  hospitalPoliceStation: [],
  transportAirport: [],
  shoppingAtm: [],
});
const EMPTY_BEFORE_VISIT = (): EditorBeforeYourVisit => ({
  parkingAvailability: '',
  cancellationPolicy: '',
  whatToBring: '',
  wheelchairAccess: '',
  insuranceAccepted: '',
  customFields: [],
});

/**
 * Category / listing intent → the natural Related Information variant. Never
 * hardcodes category *names*; keys off productType + the canonical
 * serviceCategory enum. Empty ⇒ let the seller pick / no section.
 */
export function defaultRelatedInfoType(
  productType: 'physical' | 'service',
  serviceCategory?: string,
): RelatedInfoType {
  if (productType !== 'service') return 'price_across_stores';
  const nearby = new Set(['hotels', 'restaurants', 'travel', 'real_estate', 'events', 'tickets', 'rental']);
  const beforeVisit = new Set([
    'doctors',
    'beauty',
    'education',
    'home_services',
    'gov_services',
    'transport',
    'recruitment',
    'b2b',
  ]);
  if (serviceCategory && nearby.has(serviceCategory)) return 'whats_nearby';
  if (serviceCategory && beforeVisit.has(serviceCategory)) return 'before_your_visit';
  // Nothing fits the three presets → a seller-defined custom section.
  return 'custom';
}

/** Seeded titles for the Product Overview section — presets, not a hard limit. */
export const OVERVIEW_PRESET_TITLES = [
  'Quality & Materials',
  'Features & Benefits',
  'Audience & Use Cases',
  'Customer Support & Assurance',
] as const;

export type ProductOptionGroup = NonNullable<CatalogProductDetail['optionGroups']>[number];
export type ProductVariantRow = NonNullable<CatalogProductDetail['productVariants']>[number];
export type ProductAddonRow = NonNullable<CatalogProductDetail['addonItems']>[number];

export function createBlankProductModel(id = 'new'): ProductEditorModel {
  return {
    id,
    title: '',
    slug: '',
    brandId: '',
    brandName: '',
    categoryId: '',
    categoryName: '',
    sku: '',
    description: '',
    image: '',
    gallery: [],
    videoUrl: '',
    productType: 'physical',
    price: 0,
    originalPrice: 0,
    stock: 0,
    status: 'DRAFT',
    rating: 0,
    reviewCount: 0,
    orderCount: 0,
    viewCount: 0,
    specs: [],
    overviewBlocks: OVERVIEW_PRESET_TITLES.map((title, i) => ({
      id: `ov-${i}`,
      title,
      bullets: [],
    })),
    bestForTags: [],
    boxContents: [],
    additionalSpecs: [],
    addonItems: [],
    deliveryRegion: '',
    deliveryBullets: [],
    warrantyMonths: 0,
    warrantyType: '',
    warrantyProvider: '',
    warrantyTerms: '',
    afterSalesBullets: [],
    optionGroups: [],
    productVariants: [],
    publicReviews: [],
    creatorVideos: [],
    relatedInfoType: '',
    priceAcrossStoresEnabled: false,
    relatedStores: [],
    adminPromotedStores: [],
    relatedInfoLockedByAdmin: false,
    whatsNearby: EMPTY_WHATS_NEARBY(),
    beforeYourVisit: EMPTY_BEFORE_VISIT(),
    customRelatedInfoTitle: '',
    customRelatedBlocks: [],
  };
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

  const addonItems = Array.isArray(detail?.addonItems)
    ? detail!.addonItems
        .map((a, i) => ({
          id: a.id || `addon-${i}`,
          title: a.title || '',
          ...(a.description ? { description: a.description } : {}),
          price: typeof a.price === 'number' ? a.price : Number(a.price) || 0,
          enabled: a.enabled !== false,
          sortOrder: typeof a.sortOrder === 'number' ? a.sortOrder : i,
          ...(a.badge ? { badge: a.badge } : {}),
          ...(typeof a.maxQuantity === 'number' ? { maxQuantity: a.maxQuantity } : {}),
        }))
        .filter((a) => a.title)
        .sort((a, b) => a.sortOrder - b.sortOrder)
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
    ? detail!.creatorContent.map((c, i) => ({
        id: c.id || `cr-${i}`,
        title: c.title || '',
        platform: c.platform || 'YouTube',
        thumbnail: c.thumbnail || '',
        videoUrl: c.videoUrl || '',
        ...(c.creatorHandle ? { creatorHandle: c.creatorHandle } : {}),
      }))
    : [];

  const overviewBlocks =
    Array.isArray(detail?.overviewBlocks) && detail!.overviewBlocks.length
      ? detail!.overviewBlocks
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((b, i) => ({
            id: b.id || `ov-${i}`,
            title: b.title || `Section ${i + 1}`,
            bullets: Array.isArray(b.bullets)
              ? b.bullets.map(String).filter(Boolean)
              : b.content
                ? [b.content]
                : [],
          }))
      : OVERVIEW_PRESET_TITLES.map((title, i) => ({ id: `ov-${i}`, title, bullets: [] as string[] }));

  const relatedStores: EditorRelatedStore[] = Array.isArray(detail?.storeComparisonList)
    ? detail!.storeComparisonList
        // Defensive: never surface an admin-owned row in the seller editor list.
        .filter((s) => s && s.storeName && s.source !== 'admin')
        .map((s, i) => ({
          id: s.id || `sc-${i}`,
          storeName: s.storeName || '',
          storeUrl: s.storeUrl || '',
          price: typeof s.price === 'number' ? s.price : Number(s.price) || 0,
          availability: s.availability || '',
          storeRating: typeof s.storeRating === 'number' ? s.storeRating : 0,
          isFeatured: s.isFeatured === true,
          logoUrl: s.logoUrl || '',
        }))
    : [];
  const adminPromotedStores: RelatedStoreEntry[] = Array.isArray(detail?.adminPromotedStores)
    ? detail!.adminPromotedStores!.filter((s) => s && s.storeName)
    : [];
  const wn = detail?.whatsNearby || {};
  const whatsNearby: EditorWhatsNearby = {
    restaurantCafe: Array.isArray(wn.restaurantCafe) ? wn.restaurantCafe.map(String) : [],
    entertainmentAttraction: Array.isArray(wn.entertainmentAttraction) ? wn.entertainmentAttraction.map(String) : [],
    hospitalPoliceStation: Array.isArray(wn.hospitalPoliceStation) ? wn.hospitalPoliceStation.map(String) : [],
    transportAirport: Array.isArray(wn.transportAirport) ? wn.transportAirport.map(String) : [],
    shoppingAtm: Array.isArray(wn.shoppingAtm) ? wn.shoppingAtm.map(String) : [],
  };
  const bv = detail?.beforeYourVisit || {};
  const beforeYourVisit: EditorBeforeYourVisit = {
    parkingAvailability: bv.parkingAvailability || '',
    cancellationPolicy: bv.cancellationPolicy || '',
    whatToBring: bv.whatToBring || '',
    wheelchairAccess: bv.wheelchairAccess || '',
    insuranceAccepted: bv.insuranceAccepted || '',
    customFields: Array.isArray((bv as { customFields?: unknown }).customFields)
      ? (bv as { customFields: Array<{ id?: string; label?: string; value?: string }> }).customFields.map((f, i) => ({
          id: f.id || `bvc-${i}`,
          label: f.label || '',
          value: f.value || '',
        }))
      : [],
  };
  const editorProductType: 'physical' | 'service' = product.productType === 'service' ? 'service' : 'physical';
  const relatedInfoType: RelatedInfoType =
    detail?.relatedInfoType === 'price_across_stores' ||
    detail?.relatedInfoType === 'whats_nearby' ||
    detail?.relatedInfoType === 'before_your_visit' ||
    detail?.relatedInfoType === 'custom'
      ? detail.relatedInfoType
      : defaultRelatedInfoType(
          editorProductType,
          (product as { serviceCategory?: string }).serviceCategory,
        );
  const customRelatedBlocks: EditorCustomRelatedBlock[] = Array.isArray(detail?.customRelatedInfo?.blocks)
    ? detail!.customRelatedInfo!.blocks!.map((b, i) => ({
        id: b.id || `crb-${i}`,
        heading: b.heading || '',
        items: Array.isArray(b.items) ? b.items.map(String).filter(Boolean) : [],
      }))
    : [];

  return {
    ...blank,
    id: product.id,
    title: product.title || '',
    slug: product.slug || '',
    brandId: product.brandId || '',
    brandName: product.brandName || '',
    categoryId: product.categoryId || '',
    categoryName: product.categoryName || '',
    sku: product.sku || '',
    description: product.description || detail?.about || '',
    image: product.image || gallery[0] || '',
    gallery: gallery.length ? gallery : product.image ? [product.image] : [],
    videoUrl: product.videoUrl || '',
    productType: product.productType === 'service' ? 'service' : 'physical',
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
    // Free-form product-detail specifications ONLY. Category / Brand are NOT
    // fabricated here — they are canonical category-schema data, not seller
    // specification rows, and folding them in used to pollute product.attributes
    // and fail schema validation on save.
    specs: fromDetailSpecs,
    overviewBlocks,
    bestForTags: Array.isArray(detail?.bestForTags) ? detail!.bestForTags.map(String) : [],
    boxContents,
    additionalSpecs,
    addonItems,
    deliveryRegion: detail?.deliveryInfo?.region || '',
    deliveryBullets: Array.isArray(detail?.deliveryInfo?.bullets)
      ? detail!.deliveryInfo!.bullets!.map(String).filter(Boolean)
      : [],
    warrantyMonths:
      typeof (product as { warrantyMonths?: number }).warrantyMonths === 'number'
        ? (product as { warrantyMonths: number }).warrantyMonths
        : Number((product as { warrantyMonths?: unknown }).warrantyMonths) || 0,
    warrantyType: (product as { warrantyType?: string }).warrantyType || '',
    warrantyProvider: (product as { warrantyProvider?: string }).warrantyProvider || '',
    warrantyTerms: (product as { warrantyTerms?: string }).warrantyTerms || '',
    afterSalesBullets: Array.isArray(detail?.afterSalesInfo?.bullets)
      ? detail!.afterSalesInfo!.bullets!.map(String).filter(Boolean)
      : [],
    optionGroups: Array.isArray(detail?.optionGroups) ? detail!.optionGroups : [],
    productVariants: Array.isArray(detail?.productVariants) ? detail!.productVariants : [],
    sizeGuide:
      detail?.sizeGuide && typeof detail.sizeGuide === 'object' ? detail.sizeGuide : undefined,
    publicReviews,
    creatorVideos,
    relatedInfoType,
    priceAcrossStoresEnabled: detail?.priceAcrossStoresEnabled === true,
    relatedStores,
    adminPromotedStores,
    relatedInfoLockedByAdmin: detail?.relatedInfoLockedByAdmin === true,
    whatsNearby,
    beforeYourVisit,
    customRelatedInfoTitle: detail?.customRelatedInfo?.title || '',
    customRelatedBlocks,
  };
}

export function editorModelToProductPatch(model: ProductEditorModel): Partial<CatalogProduct> {
  // NOTE: `product.attributes` (canonical, category-schema-validated) is
  // deliberately NOT written from here. The Studio's "Specifications" section is
  // free-form product-detail data (`detail.specs`); it must never become a
  // category facet or be schema-validated. Category attributes are managed on
  // their own path and are preserved untouched by omitting the key.
  return {
    title: model.title,
    description: model.description,
    brandId: model.brandId || undefined,
    brandName: model.brandName || undefined,
    categoryId: model.categoryId || undefined,
    categoryName: model.categoryName || undefined,
    sku: model.sku.trim() || undefined,
    image: model.image || undefined,
    gallery: model.gallery.length ? model.gallery : model.image ? [model.image] : [],
    videoUrl: model.videoUrl ? model.videoUrl : '',
    productType: model.productType,
    price: model.price,
    originalPrice: model.originalPrice || undefined,
    stock: model.stock,
    status: model.status === 'LIVE' ? 'live' : model.status === 'ARCHIVED' ? 'archived' : 'draft',
    warrantyMonths: model.warrantyMonths > 0 ? Math.floor(model.warrantyMonths) : undefined,
    warrantyType: model.warrantyType.trim() || undefined,
    warrantyProvider: model.warrantyProvider.trim() || undefined,
    warrantyTerms: model.warrantyTerms.trim() || undefined,
  };
}

export function editorModelToDetailPayload(model: ProductEditorModel): Partial<CatalogProductDetail> {
  const overviewBlocks: CatalogProductDetail['overviewBlocks'] = (model.overviewBlocks ?? [])
    .filter((b) => b.title.trim())
    .map((b, i) => ({
      id: b.id || `ov-${i}`,
      title: b.title.trim(),
      content: '',
      bullets: (b.bullets ?? []).map((x) => x.trim()).filter(Boolean),
      enabled: (b.bullets ?? []).some((x) => x.trim()),
      sortOrder: i + 1,
    }));

  // Related Information — SELLER-owned surface only. `adminPromotedStores` and
  // `relatedInfoLockedByAdmin` are Choosify-owned and are NEVER written from the
  // seller Studio (the server also ignores them from a non-admin caller).
  const relatedStores = (model.relatedStores ?? [])
    .filter((s) => (s.storeName || '').trim())
    .map((s, i) => ({
      id: s.id || `sc-${i}`,
      storeName: s.storeName.trim(),
      price: typeof s.price === 'number' ? Math.max(0, s.price) : Number(s.price) || 0,
      availability: (s.availability || '').trim() || 'See store',
      ...(s.storeUrl && s.storeUrl.trim() ? { storeUrl: s.storeUrl.trim() } : {}),
      ...(s.storeRating > 0 ? { storeRating: Math.max(0, Math.min(5, s.storeRating)) } : {}),
      ...(s.logoUrl && s.logoUrl.trim() ? { logoUrl: s.logoUrl.trim() } : {}),
      ...(s.isFeatured ? { isFeatured: true as const } : {}),
      source: 'seller' as const,
    }));
  const trimArr = (a: string[]) => (a ?? []).map((v) => v.trim()).filter(Boolean);

  return {
    productId: model.id,
    about: model.description || undefined,
    // Free-form product-detail specifications — presentation data, never folded
    // into category attributes / schema validation.
    specs: model.specs,
    // NOTE: `pros`, `cons`, `physicalStores` and `publicReviews` are intentionally
    // NOT sent. The Studio does not edit them, so emitting `[]` here used to WIPE
    // any existing canonical value on an unrelated section save. Omitting the key
    // makes the server preserve it.
    bestForTags: model.bestForTags,
    storeComparisonList: relatedStores,
    ...(model.relatedInfoType ? { relatedInfoType: model.relatedInfoType } : {}),
    customRelatedInfo: {
      ...(model.customRelatedInfoTitle.trim() ? { title: model.customRelatedInfoTitle.trim() } : {}),
      blocks: (model.customRelatedBlocks ?? [])
        .map((b, i) => ({
          id: b.id || `crb-${i}`,
          heading: (b.heading || '').trim(),
          items: (b.items ?? []).map((v) => v.trim()).filter(Boolean),
        }))
        .filter((b) => b.heading || b.items.length),
    },
    priceAcrossStoresEnabled: model.priceAcrossStoresEnabled,
    enableStoreComparison: relatedStores.length > 0 || model.priceAcrossStoresEnabled,
    whatsNearby: {
      restaurantCafe: trimArr(model.whatsNearby?.restaurantCafe),
      entertainmentAttraction: trimArr(model.whatsNearby?.entertainmentAttraction),
      hospitalPoliceStation: trimArr(model.whatsNearby?.hospitalPoliceStation),
      transportAirport: trimArr(model.whatsNearby?.transportAirport),
      shoppingAtm: trimArr(model.whatsNearby?.shoppingAtm),
    },
    beforeYourVisit: {
      parkingAvailability: (model.beforeYourVisit?.parkingAvailability || '').trim(),
      cancellationPolicy: (model.beforeYourVisit?.cancellationPolicy || '').trim(),
      whatToBring: (model.beforeYourVisit?.whatToBring || '').trim(),
      wheelchairAccess: (model.beforeYourVisit?.wheelchairAccess || '').trim(),
      insuranceAccepted: (model.beforeYourVisit?.insuranceAccepted || '').trim(),
      customFields: (model.beforeYourVisit?.customFields ?? [])
        .map((f, i) => ({ id: f.id || `bvc-${i}`, label: (f.label || '').trim(), value: (f.value || '').trim() }))
        .filter((f) => f.label || f.value)
        .slice(0, 12),
    },
    overviewBlocks,
    // Generic — whatever dimensions/values the seller configured against the
    // category schema. No Color/Size/Storage special-casing. Empty groups
    // (a dimension toggled on but given no values) are not persisted.
    optionGroups: (model.optionGroups ?? []).filter((g) => (g.values?.length ?? 0) > 0),
    productVariants: model.productVariants ?? [],
    // Only sent when the seller has actually configured a guide — otherwise the
    // key is omitted so the server preserves any existing value. Informational
    // only; never affects variants / price / SKU / stock / checkout.
    ...(model.sizeGuide !== undefined ? { sizeGuide: model.sizeGuide } : {}),
    creatorContent: model.creatorVideos
      .filter((c) => (c.videoUrl || '').trim() || (c.title || '').trim() || (c.thumbnail || '').trim())
      .map((c, i) => ({
        id: c.id || `cr-${i}`,
        platform: c.platform || 'YouTube',
        videoUrl: (c.videoUrl || '').trim(),
        thumbnail: (c.thumbnail || '').trim(),
        title: (c.title || '').trim(),
        ...(c.creatorHandle && c.creatorHandle.trim() ? { creatorHandle: c.creatorHandle.trim() } : {}),
      })),
    boxContents: model.boxContents.map((title, i) => ({
      id: `box-${i}`,
      title,
      isFree: true,
      enabled: true,
      sortOrder: i + 1,
    })),
    additionalSpecs: model.additionalSpecs,
    // Carried faithfully — server normalizer coerces/defaults the additive fields.
    addonItems: (model.addonItems ?? []).map((a, i) => ({
      id: a.id || `addon-${i}`,
      title: a.title,
      ...(a.description ? { description: a.description } : {}),
      price: typeof a.price === 'number' ? a.price : Number(a.price) || 0,
      enabled: a.enabled !== false,
      sortOrder: typeof a.sortOrder === 'number' ? a.sortOrder : i,
      ...(a.badge ? { badge: a.badge } : {}),
      ...(typeof a.maxQuantity === 'number' ? { maxQuantity: a.maxQuantity } : {}),
    })),
    deliveryInfo: {
      ...((model.deliveryRegion || '').trim() ? { region: (model.deliveryRegion || '').trim() } : {}),
      bullets: (model.deliveryBullets || []).map((b) => b.trim()).filter(Boolean),
    },
    enableDeliveryInfo:
      !!(model.deliveryRegion || '').trim() || (model.deliveryBullets || []).some((b) => b.trim()),
    afterSalesInfo: {
      bullets: (model.afterSalesBullets || []).map((b) => b.trim()).filter(Boolean),
    },
    enableWarrantyInfo:
      model.warrantyMonths > 0 ||
      !!(model.warrantyType || '').trim() ||
      !!(model.warrantyProvider || '').trim() ||
      !!(model.warrantyTerms || '').trim() ||
      (model.afterSalesBullets || []).some((b) => b.trim()),
    updatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC VARIANT HELPERS (category-schema-driven, no Color/Size/Storage bias)
// ─────────────────────────────────────────────────────────────────────────────

/** Stable key for a combination — order-independent on dimension name. */
export function variantKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('|');
}

/** Cartesian product of the enabled option groups' selected values. */
export function generateCombinations(
  groups: Array<{ name: string; values: string[] }>,
): Array<Record<string, string>> {
  const usable = groups.filter((g) => g.name.trim() && g.values.length > 0);
  if (!usable.length) return [];
  let acc: Array<Record<string, string>> = [{}];
  for (const g of usable) {
    const next: Array<Record<string, string>> = [];
    for (const row of acc) {
      for (const v of g.values) next.push({ ...row, [g.name]: v });
    }
    acc = next;
  }
  return acc;
}

/** Back-compat: a variant with no explicit `status` is active unless `enabled === false`. */
export function variantIsActive(v: { enabled?: boolean; status?: 'active' | 'inactive' }): boolean {
  if (v.status) return v.status === 'active';
  return v.enabled !== false;
}

export type SchemaVariantDimension = { key: string; name: string; type: string; options: string[] };

export type CategorySchemaCompatibility = {
  compatible: boolean;
  /** option-group names that are not variant-eligible dimensions of the new schema */
  invalidGroups: string[];
  /** `${dimension} → ${value}` pairs not permitted by the new schema */
  invalidValues: string[];
  /** variant combinations that reference an invalid group or value */
  invalidVariantIds: string[];
};

/**
 * Compare the product's CURRENT optionGroups / productVariants against a
 * candidate category's variant-eligible dimensions. Used to gate a category
 * change: if not `compatible`, the Studio must force Remap / Clear-with-confirm
 * / Cancel — never silently keep schema-invalid variants, never silently delete.
 */
export function checkCategorySchemaCompatibility(
  optionGroups: ProductOptionGroup[],
  productVariants: ProductVariantRow[],
  schemaDims: SchemaVariantDimension[],
): CategorySchemaCompatibility {
  const norm = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const dimByAlias = new Map<string, SchemaVariantDimension>();
  for (const d of schemaDims) {
    dimByAlias.set(norm(d.key), d);
    dimByAlias.set(norm(d.name), d);
  }
  const resolve = (name: string) => dimByAlias.get(norm(name));

  // Hybrid model: seller custom dimensions are product-local and category-
  // agnostic — a category change never invalidates them. Only CANONICAL
  // (category-schema) dimensions can be incompatible with a new schema.
  const customNames = new Set(optionGroups.filter((g) => g.custom).map((g) => norm(g.name)));
  const isCustom = (name: string) => customNames.has(norm(name));

  // Seller-appended values on a canonical `select` dimension are product-local
  // and are never invalidated by a category change.
  const customValuesByDim = new Map<string, Set<string>>();
  for (const g of optionGroups) {
    if (!g.customValues?.length) continue;
    const set = customValuesByDim.get(norm(g.name)) ?? new Set<string>();
    for (const v of g.customValues) set.add(v);
    customValuesByDim.set(norm(g.name), set);
  }
  const isCustomValue = (dimName: string, value: string) =>
    customValuesByDim.get(norm(dimName))?.has(value) === true;

  const invalidGroups: string[] = [];
  const invalidValues: string[] = [];
  for (const g of optionGroups) {
    if (g.custom) continue;
    const dim = resolve(g.name);
    if (!dim) {
      invalidGroups.push(g.name);
      continue;
    }
    if (dim.type === 'select' || dim.type === 'multi_select') {
      for (const v of g.values) {
        if (!dim.options.includes(v) && !isCustomValue(g.name, v)) invalidValues.push(`${g.name} → ${v}`);
      }
    }
  }

  const invalidVariantIds: string[] = [];
  for (const variant of productVariants) {
    for (const [k, v] of Object.entries(variant.options || {})) {
      if (isCustom(k)) continue;
      const dim = resolve(k);
      if (!dim) {
        invalidVariantIds.push(variant.id);
        break;
      }
      if (
        (dim.type === 'select' || dim.type === 'multi_select') &&
        !dim.options.includes(v) &&
        !isCustomValue(k, v)
      ) {
        invalidVariantIds.push(variant.id);
        break;
      }
    }
  }

  return {
    compatible: !invalidGroups.length && !invalidValues.length && !invalidVariantIds.length,
    invalidGroups,
    invalidValues,
    invalidVariantIds: [...new Set(invalidVariantIds)],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING-PRODUCT LOAD SAFETY (data-integrity hazard fix)
//
// For an existing product id the authoritative record MUST come from the catalog
// API. If the list call fails, or the id is not in the caller's catalog, the
// Studio must enter an explicit load-error state and keep every Save/Publish
// path disabled. It must NEVER substitute createBlankProductModel() for a real
// product id — a later PATCH would then overwrite the live listing with an empty
// model. createBlankProductModel() is for the genuine New Product flow only.
// ─────────────────────────────────────────────────────────────────────────────

export type ProductLoadResult =
  | { status: 'ok'; model: ProductEditorModel }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

export interface ProductLoadDeps {
  /**
   * Authoritative single-record fetch (GET /catalog/products/:id). Resolves with
   * the product, or rejects — a 404 / "not found" message means the id genuinely
   * isn't in the caller's catalog; any other rejection is treated as an infra
   * failure. This is deliberately NOT the filtered/paginated list endpoint.
   */
  getProduct: (id: string) => Promise<CatalogProduct>;
  getProductDetail: (id: string) => Promise<CatalogProductDetail | null>;
  /** This product's own locally cached in-progress draft, if any. */
  readCache?: () => ProductEditorModel | null;
}

const NOT_FOUND_RE = /\b(not found|404|no such|does not exist|doesn.?t exist)\b/i;

export async function resolveExistingProductLoad(
  activeId: string,
  deps: ProductLoadDeps,
): Promise<ProductLoadResult> {
  let product: CatalogProduct;
  try {
    product = await deps.getProduct(activeId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || '');
    if (NOT_FOUND_RE.test(message)) return { status: 'notfound' };
    return {
      status: 'error',
      message: message || 'Could not reach the catalog service.',
    };
  }
  if (!product || typeof product !== 'object' || product.id !== activeId) {
    return { status: 'notfound' };
  }

  let detail: CatalogProductDetail | null = null;
  try {
    detail = await deps.getProductDetail(activeId);
  } catch {
    detail = null;
  }

  const fromCatalog = mapCatalogProductToEditor(product, detail);

  let cached: ProductEditorModel | null = null;
  try {
    cached = deps.readCache?.() ?? null;
  } catch {
    cached = null;
  }

  // The local cache may only OVERLAY the authoritative record for this exact id,
  // never substitute for it.
  const model: ProductEditorModel =
    cached && cached.id === activeId
      ? {
          ...fromCatalog,
          ...cached,
          id: activeId,
          // Identity fields keep the authoritative value whenever the cached
          // copy is blank/corrupt — the cache may overlay edits, never erase.
          title: cached.title || fromCatalog.title,
          slug: cached.slug || fromCatalog.slug,
          brandId: cached.brandId || fromCatalog.brandId,
          brandName: cached.brandName || fromCatalog.brandName,
          categoryId: cached.categoryId || fromCatalog.categoryId,
          categoryName: cached.categoryName || fromCatalog.categoryName,
          image: cached.image || fromCatalog.image,
          gallery: cached.gallery?.length ? cached.gallery : fromCatalog.gallery,
          specs: cached.specs?.length ? cached.specs : fromCatalog.specs,
          // Server-owned, never seller-edited in the Studio.
          publicReviews: fromCatalog.publicReviews,
          creatorVideos: fromCatalog.creatorVideos,
        }
      : fromCatalog;

  return { status: 'ok', model };
}

/**
 * Gate for every Studio persistence path (saveSection / handlePublish).
 * Returns true only when the model in hand is safe to write back for `activeId`.
 * A missing model, a load error, or an id mismatch (e.g. a stray blank model)
 * all fail closed.
 */
export function isSafeToPersist(
  model: ProductEditorModel | null,
  opts: { isNew: boolean; activeId: string; hasLoadError: boolean },
): boolean {
  if (opts.hasLoadError) return false;
  if (!model) return false;
  if (opts.isNew) return model.id === 'new' || model.id === opts.activeId;
  return model.id === opts.activeId;
}
