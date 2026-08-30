/**
 * Product/Service publish status wire values.
 * `live` is the legacy persisted form of Active (ES-005 / IS-003).
 * Prefer server/catalog/productLifecycle helpers over comparing raw strings.
 */
export type CatalogPublishStatus =
  | 'draft'
  | 'live'
  | 'active'
  | 'out_of_stock'
  | 'suspended'
  | 'archived';

export interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  parentId: string | null;
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CatalogAttributeType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select';

export interface CatalogCategoryAttribute {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  type: CatalogAttributeType;
  required: boolean;
  searchable: boolean;
  filterable: boolean;
  comparable: boolean;
  variantEligible: boolean;
  unit?: string;
  options: string[];
  displayOrder: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
  /** Seller-added links beyond the presets (Discord, Threads, a blog, …). */
  custom?: Array<{ label: string; url: string }>;
}

export interface CatalogBrandOverview {
  address?: string;
  /** Google Maps (or any map) URL for the shop address — "Open on Maps" link. */
  mapLink?: string;
  email?: string;
  phone?: string;
  priceRange?: string;
  ageFocus?: string;
  audience?: string;
  services?: string[];
  tags?: string[];
}

export interface CatalogBrandFaq {
  q: string;
  a: string;
}

export interface CatalogBrandStores {
  authorized?: Array<{ name: string; sub?: string }>;
  distributors?: Array<{ name: string; sub?: string }>;
  serviceCenters?: Array<{ name: string; sub?: string; hours?: string }>;
}

export interface CatalogBrandPromoCode {
  id: string;
  code: string;
  discountType: 'Percentage' | 'Flat';
  discountValue: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  enabled: boolean;
}

export interface CatalogBrand {
  id: string;
  slug: string;
  name: string;
  /** Permanent Choosify Brand Reference ID (BR-#####). Display/search only. */
  brandReferenceId?: string;
  category: string;
  description: string;
  logo: string;
  coverImage?: string;
  tagline?: string;
  website?: string;
  socialLinks?: CatalogSocialLinks;
  story?: string;
  /**
   * Multi-entry Brand Story — a titled list of hybrid story sections shown on
   * the storefront (falls back to `story` when empty). Each section is one of:
   *  - `text`    (default): heading + body paragraph
   *  - `link`   : an external URL + a custom thumbnail image
   *  - `content`: a Guide / Review / Live / blog the seller published on Choosify
   */
  storyBlocks?: Array<{
    id: string;
    heading: string;
    body: string;
    kind?: 'text' | 'link' | 'content';
    url?: string;
    thumbnail?: string;
    contentId?: string;
    /** Media/platform of the link — drives the storefront video aspect ratio. Absent ⇒ auto-detect from `url`. */
    mediaKind?:
      | 'youtube'
      | 'youtube_shorts'
      | 'instagram_reel'
      | 'instagram_post'
      | 'tiktok'
      | 'facebook'
      | 'other';
  }>;
  /** Derived mirror — the `contentId`s of the `content` story sections, in order. */
  pinnedStoryContentIds?: string[];
  storyVideoUrl?: string;
  credentials?: string;
  overview?: CatalogBrandOverview;
  faq?: CatalogBrandFaq[];
  stores?: CatalogBrandStores;
  promoCodes?: CatalogBrandPromoCode[];
  /**
   * Seller-curated product ids spotlighted at the top of the brand page's
   * "Top Deals & Coupons" section, in display order. Ids that no longer resolve
   * to a live product of this brand are ignored at render time.
   */
  pinnedProductIds?: string[];
  /** Seller-curated product ids pinned to the front of the brand page's Products grid, in order. */
  pinnedShowcaseProductIds?: string[];
  verifiedStatus: boolean;
  claimStatus: 'community' | 'pending' | 'verified';
  followers: number;
  ratings: number;
  /** Optional rating sub-scores shown on brand comparison. Falls back to `ratings` when absent. */
  qualityScore?: number;
  valueScore?: number;
  supportScore?: number;
  featuredFlag: boolean;
  sponsoredFlag: boolean;
  /** Owning seller user id when brand is seller-managed; omitted for platform/legacy rows. */
  sellerId?: string;
  /**
   * Public storefront visibility. Seller drafts default false until Marketplace Access is ON.
   * Seeded / platform brands default true. Kept in sync with marketplaceStatus:
   * true for 'granted'/'restored', false for every other status.
   */
  marketplaceAccess?: boolean;
  /** ES-005 Marketplace Access lifecycle. Controls public visibility only — never ownership/editing. */
  marketplaceStatus?: CatalogMarketplaceStatus;
  createdAt: string;
  updatedAt: string;
}

export type CatalogMarketplaceStatus =
  | 'not_granted'
  | 'granted'
  | 'restricted'
  | 'suspended'
  | 'restored'
  | 'revoked';

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  /** Permanent Choosify Product Reference ID (PR-#####). Not SKU. */
  productReferenceId?: string;
  description: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  image: string;
  gallery: string[];
  /**
   * Optional single storefront product video. One canonical source only:
   * a YouTube URL, a direct HTTPS video file URL (.mp4/.webm/.mov), or a
   * `/media/products/*.mp4` produced by the app's own media upload. Empty /
   * absent = no product video. Feeds the Product Detail media carousel
   * alongside `image` + `gallery`.
   */
  videoUrl?: string;
  modeType: 'retail';
  /** physical (default) or bookable service listing */
  productType?: 'physical' | 'service';
  /** Required when productType is service */
  serviceCategory?:
    | 'hotels'
    | 'restaurants'
    | 'travel'
    | 'doctors'
    | 'education'
    | 'beauty'
    | 'real_estate'
    | 'transport'
    | 'events'
    | 'tickets'
    | 'home_services'
    | 'gov_services'
    | 'recruitment'
    | 'b2b'
    | 'rental'
    | 'donation';
  relatedInfoType?: 'price_across_stores' | 'whats_nearby' | 'before_your_visit';
  /** Physical products: opt-in toggle for showing Price Across Stores. */
  priceAcrossStoresEnabled?: boolean;
  /** Seller opt-in toggle for accepting an advance/partial payment on this product. */
  partialPaymentEnabled?: boolean;
  /** Deposit percent required upfront when partialPaymentEnabled is true; must fall within the admin-configured range. */
  depositPercent?: number;
  /** Keys from SERVICE_BOOKING_FIELDS the seller requires from buyers (defaults to all required fields) */
  requiredBookingFieldKeys?: string[];
  /**
   * Service listings only. Whether a new booking request needs the seller to manually
   * accept it before the buyer can pay. `undefined` = follow the seller's account-wide
   * default (see `OpsSellerBookingSettings`); `true` = always require approval; `false`
   * = auto-approve instantly so the buyer goes straight to Pay & Confirm.
   */
  requiresApproval?: boolean;
  price: number;
  originalPrice?: number;
  stock: number;
  /** Optional seller/catalog SKU — coexists with productReferenceId; not a substitute for it. */
  sku?: string;
  status: CatalogPublishStatus;
  /** Warranty configuration set by the seller. Orders snapshot these at purchase time. */
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyProvider?: string;
  warrantyTerms?: string;
  tags: string[];
  isDeal: boolean;
  dealType?: 'flash' | 'seasonal' | 'brand' | 'promo' | 'clearance';
  discountPercent?: number;
  promoCode?: string;
  dealValidUntil?: string;
  featuredFlag: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
  /** Firebase uid of owning seller when listing is seller-managed; omitted for legacy/admin rows. */
  sellerId?: string;
  /** Per-listing attribute values keyed by category attribute `key` (IS-003 §11). */
  attributes?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service catalog foundation (Sprint 3). Dedicated resource — booking engine deferred.
 * Lifecycle reuses CatalogPublishStatus (`live` ≡ Active).
 */
export interface CatalogService {
  id: string;
  slug: string;
  title: string;
  description: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  serviceCategory?: CatalogProduct['serviceCategory'];
  price: number;
  currency: string;
  durationMinutes?: number;
  serviceArea?: string;
  media: string[];
  image: string;
  status: CatalogPublishStatus;
  sellerId?: string;
  /** Per-listing attribute values keyed by category attribute `key` (IS-003 §12). */
  attributes?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Server inventory record shape (IS-003). */
export interface CatalogInventory {
  id: string;
  productId: string;
  variantId?: string;
  sku?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  inventoryState: 'in_stock' | 'low_stock' | 'out_of_stock' | 'archived';
  warehouseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogDeal {
  id: string;
  slug: string;
  name: string;
  seller: string;
  category: string;
  status: 'live' | 'pending' | 'expiring' | 'expired' | 'rejected' | 'draft';
  type: 'retail';
  discountType: 'percentage' | 'flat';
  discountValue: number;
  promoCode?: string;
  productId?: string;
  brandId?: string;
  clicks: number;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export type CatalogBrandPostKind = 'event' | 'launch' | 'festival' | 'campaign' | 'store_moment';
export type CatalogBrandPostStatus = 'scheduled' | 'live' | 'expired';

export interface CatalogBrandPost {
  id: string;
  slug: string;
  brandId: string;
  brandName: string;
  brandLogo?: string;
  kind: CatalogBrandPostKind;
  title: string;
  excerpt: string;
  heroImage: string;
  bannerImages?: string[];
  body: string[];
  startDate?: string;
  endDate?: string;
  location?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  linkedProductIds?: string[];
  sponsored: boolean;
  status: CatalogBrandPostStatus;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageHeroBanner {
  id: string;
  headline: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  backgroundImage: string;
  isActive: boolean;
  order: number;
}

export type DealsBannerDestinationType = 'product' | 'brand' | 'custom-url';

export interface CatalogDealsBanner {
  id: string;
  image: string;
  destinationType: DealsBannerDestinationType;
  destinationRef: string;
  order: number;
  isActive: boolean;
  /** Optional sponsor mark for carousel logo pagination / PROMOTED chrome */
  brandName?: string;
  brandLogoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageSectionConfig {
  id: string;
  label: string;
  isVisible: boolean;
  order: number;
  itemIds: string[];
}

export interface HomepageConfig {
  id: 'default';
  heroBanners: HomepageHeroBanner[];
  dealsBanners: CatalogDealsBanner[];
  sections: HomepageSectionConfig[];
  featuredProductIds: string[];
  featuredBrandIds: string[];
  featuredDealIds: string[];
  featuredCreatorIds: string[];
  featuredGuideIds: string[];
  updatedAt: string;
}

export interface SiteNavItem {
  id: string;
  label: string;
  path: string;
  order: number;
}

export interface SiteFooterLink {
  label: string;
  url: string;
}

export interface SiteFooterColumn {
  id: string;
  title: string;
  links: SiteFooterLink[];
}

export interface SiteSocialLink {
  id: string;
  platform: string;
  url: string;
  isVisible: boolean;
  order: number;
}

export interface SitePopularSearch {
  id: string;
  term: string;
  order: number;
  isActive: boolean;
}

export interface SiteProductBadge {
  id: string;
  label: string;
  color: string;
  icon?: string;
  priority: number;
  isActive: boolean;
}

export interface SiteWebsiteAssets {
  navbarLogo: string;
  footerLogo: string;
  favicon: string;
  pwaIcon: string;
  defaultProductImage: string;
}

export interface SiteConfig {
  id: 'default';
  navigation: SiteNavItem[];
  footer: {
    description: string;
    copyrightText: string;
    columns: SiteFooterColumn[];
    newsletterEnabled: boolean;
  };
  socialLinks: SiteSocialLink[];
  popularSearches: SitePopularSearch[];
  seoEntries: SiteSeoEntry[];
  announcementBarText: string;
  announcementBarEnabled: boolean;
  productBadges?: SiteProductBadge[];
  websiteAssets?: SiteWebsiteAssets;
  updatedAt: string;
}

export interface CatalogSnapshot {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  deals: CatalogDeal[];
  homepage: HomepageConfig;
  creators?: CatalogCreator[];
  guides?: CatalogGuide[];
  placements?: CatalogPlacement[];
  productDetails?: CatalogProductDetail[];
}

export interface CatalogMediaItem {
  id: string;
  title: string;
  thumbnail: string;
  views?: string;
  duration?: string;
  likes?: string;
  excerpt?: string;
  readTime?: string;
  date?: string;
  url: string;
  associatedGuideId?: string;
}

export interface CatalogCreatorSocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
}

export interface CatalogCreator {
  id: string;
  slug: string;
  name: string;
  handle: string;
  avatar: string;
  coverImage?: string;
  role?: string;
  location?: string;
  reviewVideoUrl?: string;
  score: number;
  bestFor: string;
  bestForTags: string[];
  platforms: string[];
  bio: string;
  followers: Record<string, string>;
  socialLinks?: CatalogCreatorSocialLinks;
  brandPartners?: { name: string; color?: string }[];
  collabTypes?: string[];
  responseTime?: string;
  preferredContact?: string;
  email?: string;
  phone?: string;
  category?: string;
  verifiedStatus: boolean;
  featuredFlag: boolean;
  videos: CatalogMediaItem[];
  reels: CatalogMediaItem[];
  blogs: CatalogMediaItem[];
  status: 'draft' | 'live' | 'archived';
  /** Owning creator user id — creator workspace is scoped to this. */
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export type GuideEntityRef = {
  entityType: 'product' | 'brand' | 'external_product' | 'external_brand';
  entityId: string;
};
export interface GuideSocialLink {
  id: string;
  platform: 'youtube' | 'facebook' | 'tiktok' | 'instagram' | 'twitch' | 'vimeo' | 'other';
  url: string;
  label?: string;
  enabled?: boolean;
  sortOrder?: number;
}
export interface GuideExternalRef {
  id: string;
  kind: 'product' | 'brand';
  title: string;
  imageUrl?: string;
  externalUrl: string;
  subtitle?: string;
  brandName?: string;
  commentary?: string;
  sortOrder?: number;
  /** Up to 4 short "why it's good for…" keyword chips shown on the card. */
  highlightTags?: string[];
}
export interface GuideLiveOffer {
  id: string;
  productId: string;
  promoPrice?: number;
  discountType?: 'percent' | 'amount';
  discountValue?: number;
  startsAt: string;
  endsAt: string;
  enabled?: boolean;
}

export interface CatalogGuide {
  id: string;
  slug: string;
  title: string;
  /** Permanent Choosify Content Reference ID (CT-#####). Covers Video/Reel/Blog/Live/Guide. */
  contentReferenceId?: string;
  author: string;
  authorAvatar?: string;
  category: string;
  excerpt?: string;
  /** Primary cover photo (= gallery[0]). May be empty for a video-only guide. */
  image: string;
  /** Ordered hero photo list (primary + extras). Independent of `videoUrl`. */
  gallery?: string[];
  videoUrl?: string;
  duration?: string;
  type: 'article' | 'reels' | 'video' | 'shorts';
  readTime: string;
  views: string;
  shares?: string;
  tags: string[];
  creatorId?: string;
  /** Public publisher identity: 'creator' (default, uses creatorId) or 'brand' (uses publisherBrandId). Server-authoritative. */
  publisherType?: 'creator' | 'brand';
  /** Canonical CatalogBrand id when publisherType === 'brand' — the AUTHOR, distinct from brandIds (mentions). */
  publisherBrandId?: string;
  /** Read-only enrichment on GET responses — resolved publisher brand identity. Never persisted. */
  publisherBrand?: { id: string; name: string; logo?: string; slug?: string };
  productIds: string[];
  /** Brands the guide MENTIONS / discusses ("Brand Mentioned"). Not authorship. Real CatalogBrand ids. */
  brandIds?: string[];
  /** Canonical main editorial/article body (plain text). Separate from Key Takeaways. */
  body?: string;
  /** Guide-scoped social / continue-on-platform links (distinct from profile socials). */
  socialLinks?: GuideSocialLink[];
  /** Guide-editorial references to off-Choosify products / brands. Never enter catalog/cart/orders/compare. */
  externalRefs?: GuideExternalRef[];
  /** Guide-scoped temporary promo pricing on tagged canonical products. Never mutates the Product. */
  liveOffers?: GuideLiveOffer[];
  verdict?: string;
  whatWeLike: string[];
  whatToConsider: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoOgImage?: string;
  seoCanonicalUrl?: string;
  status: 'draft' | 'live' | 'archived';
  publishedAt: string;
  updatedAt: string;
  /** Optional Content Detail sections (ordered toggles + data) authored in Guide Edit Studio. */
  sections?: Array<{
    id: string;
    enabled: boolean;
    order: number;
    data?: Record<string, unknown>;
  }>;
  /** Explicit editorial format — drives SpotlightContentType resolution on the storefront. */
  format?: 'buying_guide' | 'product_review' | 'comparison' | 'live' | 'tutorial' | 'tips';
  /** Admin-authored live session config — only meaningful when format === 'live'. */
  live?: {
    status?: 'live' | 'upcoming' | 'replay' | 'ended';
    platform?: 'youtube' | 'facebook' | 'tiktok' | 'instagram' | 'vimeo' | 'native';
    embedUrl?: string;
    scheduledAt?: string;
  };
}

export type CatalogPlacementSponsorType =
  | 'sponsored_product'
  | 'sponsored_brand'
  | 'spotlight_brand'
  | 'sponsored_deal'
  | 'sponsored_recommendation';

export interface CatalogPlacement {
  id: string;
  entityType: 'product' | 'brand' | 'deal' | 'guide' | 'creator';
  entityId: string;
  sponsorType: CatalogPlacementSponsorType;
  placement: string;
  title?: string;
  image?: string;
  startDate: string;
  endDate: string;
  hasCountdown: boolean;
  dealPrice?: number;
  originalPrice?: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One "Where to Buy / Price Across Stores" row. `source` marks ownership. */
export interface RelatedStoreEntry {
  id: string;
  storeName: string;
  price: number;
  availability: string;
  storeRating?: number;
  storeUrl?: string;
  storeLocation?: string;
  isFeatured?: boolean;
  /** Optional visual identity. Prefer a resolved Choosify seller/brand asset. */
  logoUrl?: string;
  /**
   * Ownership. `seller` (default) = the listing owner manages it. `admin` =
   * a Choosify-promoted / sponsored entry — sellers can never edit, delete,
   * disable, reorder or mutate these. Server-enforced.
   */
  source?: 'seller' | 'admin';
  /** admin rows only — badge wording ("Sponsored", "Featured by Choosify", …). */
  promoLabel?: string;
  /** admin rows only — lower sorts earlier in the merged storefront list. */
  priority?: number;
  /** admin rows only — optional link to an Ads campaign reference (AD-#####). */
  adRef?: string;
}

export interface CatalogProductDetail {
  productId: string;
  relatedInfoType?: 'price_across_stores' | 'whats_nearby' | 'before_your_visit' | 'custom';
  priceAcrossStoresEnabled?: boolean;
  /** Seller-defined Related Information section (titled heading + bullet blocks). */
  customRelatedInfo?: {
    title?: string;
    blocks?: Array<{ id: string; heading: string; items: string[] }>;
  };
  /**
   * Admin-only section lock. When true, seller management of the Related
   * Information section is temporarily restricted by Choosify — seller sees all
   * content read-only. Server-enforced. NOT how sponsored rows are represented.
   */
  relatedInfoLockedByAdmin?: boolean;
  /** Choosify/admin-owned promoted "Where to Buy" entries (independent list). */
  adminPromotedStores?: RelatedStoreEntry[];
  whatsNearby?: {
    restaurantCafe?: string[];
    entertainmentAttraction?: string[];
    hospitalPoliceStation?: string[];
    transportAirport?: string[];
    shoppingAtm?: string[];
  };
  beforeYourVisit?: {
    parkingAvailability?: string;
    cancellationPolicy?: string;
    whatToBring?: string;
    wheelchairAccess?: string;
    insuranceAccepted?: string;
    /** Seller-added fields beyond the five presets. */
    customFields?: Array<{ id: string; label: string; value: string }>;
  };
  about?: string;
  specs: { key: string; value: string }[];
  pros: string[];
  cons: string[];
  bestForTags: string[];
  /** Seller-owned "Where to Buy / Price Across Stores" rows. */
  storeComparisonList: RelatedStoreEntry[];
  physicalStores: Array<{
    id: string;
    storeName: string;
    address: string;
    badgeLabel?: string;
    contactNumber?: string;
    city?: string;
  }>;
  overviewBlocks: Array<{
    id: string;
    title: string;
    content: string;
    bullets: string[];
    enabled: boolean;
    sortOrder: number;
  }>;
  optionGroups: Array<{
    id: string;
    name: string;
    displayType: string;
    values: string[];
    /**
     * Additive (hybrid variants): true when the seller added this dimension on
     * THIS product rather than it coming from the category variant schema.
     * Custom dimensions drive variant resolution + pricing but are not category
     * search facets and are never flagged incompatible on a category change.
     */
    custom?: boolean;
    /**
     * Additive (hybrid variants): for a category `select` dimension, values the
     * seller appended beyond the category schema's option list. Not search
     * facets; never flagged incompatible on a category change.
     */
    customValues?: string[];
  }>;
  productVariants: Array<{
    id: string;
    sku: string;
    price?: number;
    /** Additive (variants sprint): per-variant MRP / strike price. */
    originalPrice?: number;
    stock?: number;
    options: Record<string, string>;
    images?: string[];
    /** Legacy on/off flag — still honored. `status` wins when both are present. */
    enabled?: boolean;
    /**
     * Additive (variants sprint): explicit lifecycle. Backward compatible —
     * absent ⇒ derive from `enabled` (enabled !== false ⇒ 'active').
     */
    status?: 'active' | 'inactive';
  }>;
  creatorContent: Array<{
    id: string;
    platform: string;
    videoUrl: string;
    thumbnail: string;
    title: string;
    creatorHandle?: string;
    views?: string | number;
  }>;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  sizeGuide?: {
    enabled: boolean;
    type?: 'table' | 'image' | 'html';
    title?: string;
    description?: string;
    imageUrl?: string;
    htmlContent?: string;
    unitLabel?: string;
    columnHeaders?: string[];
    rows?: Array<{ size: string; [measurement: string]: string }>;
  };
  updatedAt: string;

  // Studio section on/off toggles — each gates the corresponding storefront section.
  enableSpecs?: boolean;
  enableStoreComparison?: boolean;
  enableInfluencerReviews?: boolean;
  enableOverviewSection?: boolean;
  enableBestForTags?: boolean;
  enablePhysicalStores?: boolean;
  enableBoxContents?: boolean;
  enableOptions?: boolean;
  enableActiveVariantSpecs?: boolean;
  enableAdditionalSpecs?: boolean;
  enablePublicReviews?: boolean;
  enableAddonItems?: boolean;
  enableDeliveryInfo?: boolean;
  enableWarrantyInfo?: boolean;

  /** Seller-authored "Delivery Information" block (region + quick-service delivery
   *  facts) shown on the storefront Product Detail. Absent ⇒ platform default. */
  deliveryInfo?: {
    region?: string;
    bullets?: string[];
  };
  /** "Warranty & After-Sales Services" — after-sales bullet list (warranty
   *  duration/type/provider/terms live on CatalogProduct). */
  afterSalesInfo?: {
    bullets?: string[];
  };

  boxContents?: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: string;
    image?: string;
    badge?: string;
    price?: number;
    isFree: boolean;
    enabled: boolean;
    sortOrder: number;
  }>;
  additionalSpecs?: { key: string; value: string }[];
  publicReviews?: Array<{ id: string; reviewerName: string; rating: number; comment: string }>;
  /**
   * Optional paid extras bought alongside the main item (distinct from variants).
   * `enabled`/`sortOrder`/`badge`/`maxQuantity` are additive (add-ons sprint) —
   * backward compatible: absent `enabled` ⇒ true.
   */
  addonItems?: Array<{
    id: string;
    title: string;
    description?: string;
    price: number;
    enabled?: boolean;
    sortOrder?: number;
    badge?: string;
    /** When set (≥1), the buyer may pick a quantity of this add-on up to this cap. */
    maxQuantity?: number;
  }>;
}

export interface SiteSeoEntry {
  pageId: string;
  pageLabel: string;
  title: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  canonicalUrl: string;
}
