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
  /** HTTPS URL for creator review / story embed */
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

/** A typed reference to something a guide compares / crowns as a winner. */
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
  /** For kind:'product' — the off-platform brand name. */
  brandName?: string;
  commentary?: string;
  sortOrder?: number;
  /** Up to 4 short "why it's good for…" keyword chips shown on the card. */
  highlightTags?: string[];
}

export interface GuideLiveOffer {
  id: string;
  /** Must be one of the guide's tagged canonical productIds. */
  productId: string;
  /** Absolute promo price, OR discountType + discountValue (one or the other). */
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
  /**
   * Ordered photo list for the guide hero — the primary (image) plus any
   * additional photos. Photos and `videoUrl` are independent: a guide may carry
   * multiple photos + a video, only a video, only photos, or neither.
   */
  gallery?: string[];
  videoUrl?: string;
  duration?: string;
  type: 'article' | 'reels' | 'video' | 'shorts';
  readTime: string;
  views: string;
  shares?: string;
  tags: string[];
  creatorId?: string;
  /**
   * Public publisher identity. `'creator'` (default) → the guide is authored by
   * the CatalogCreator in `creatorId` and the storefront shows "About the
   * Author". `'brand'` → authored by the CatalogBrand in `publisherBrandId` and
   * the storefront shows "About the Brand" (no author card). Server-authoritative:
   * a brand publisher is only accepted when the writer owns/administers that brand.
   */
  publisherType?: 'creator' | 'brand';
  /**
   * Canonical CatalogBrand id when `publisherType === 'brand'`. This is the
   * AUTHOR, and is distinct from `brandIds` (brands merely *mentioned/discussed*
   * by the guide). Never inferred from `brandIds`.
   */
  publisherBrandId?: string;
  /**
   * Read-only enrichment added on GET responses only — the resolved publisher
   * brand identity for rendering "About the Brand". Never persisted; the
   * normalizer drops it.
   */
  publisherBrand?: { id: string; name: string; logo?: string; slug?: string };
  productIds: string[];
  /**
   * Canonical Brand relationship — brands the guide *mentions / discusses*
   * ("Brand Mentioned" on creator-authored content). Real CatalogBrand ids.
   * NOT authorship. Additive — legacy guides that only carried brand ids inside
   * sections['brands_mentioned'].data.brandIds are read back into this field by
   * the normalizer (canonical wins when both exist).
   */
  brandIds?: string[];
  /**
   * Canonical main editorial/article body (plain text). Replaces the legacy
   * misuse of sections['takeaways'].data.takeawayBody as a generic body store —
   * Key Takeaways and Article Body are now separate. Legacy guides keep their
   * takeaway text; `body` is simply undefined for them.
   */
  body?: string;
  /**
   * Guide-scoped social / "continue on platform" links for THIS guide only.
   * Distinct from the creator/brand profile's global social links. Server
   * validates the URL and platform.
   */
  socialLinks?: GuideSocialLink[];
  /**
   * Guide-editorial references to products / brands that are NOT on Choosify.
   * They live ONLY inside the guide(s) that reference them — never the catalog,
   * brand directory, cart, checkout, orders, inventory or Compare, and never
   * acquire a CF / product / brand id or Choosify verification.
   */
  externalRefs?: GuideExternalRef[];
  /**
   * Guide-scoped temporary promotional pricing on TAGGED canonical products.
   * NEVER mutates the underlying CatalogProduct price. Checkout revalidates with
   * server time. V1 authority: only brand/seller-authored guides, only on
   * products owned by the publisher brand's seller.
   */
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
  sections?: Array<{
    id: string;
    enabled: boolean;
    order: number;
    data?: Record<string, unknown>;
  }>;
  format?: 'buying_guide' | 'product_review' | 'comparison' | 'live' | 'tutorial' | 'tips';
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
  /**
   * Seller-defined "Related Information" section for listings that don't fit the
   * three preset variants. A titled section with one or more heading + bullet
   * blocks (rendered as columns, like Product Overview). Seller-owned.
   */
  customRelatedInfo?: {
    title?: string;
    blocks?: Array<{ id: string; heading: string; items: string[] }>;
  };
  /**
   * Admin-only. When true, seller management of the Related Information section
   * is temporarily restricted by Choosify — the seller sees all content
   * (their own + admin-promoted) read-only. Server-enforced, not UI-only.
   * This is a section lock, NOT how sponsored rows are represented.
   */
  relatedInfoLockedByAdmin?: boolean;
  /**
   * Choosify/admin-owned promoted "Where to Buy" entries, kept in a list
   * independent of the seller's own `storeComparisonList`. Merged with the
   * seller list only for storefront presentation. Sellers cannot read-write
   * these through the product-details endpoint.
   */
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
     * Additive (hybrid variants): true when this dimension was added by the
     * seller on THIS product rather than coming from the category's
     * variant-eligible schema. Custom dimensions drive variant resolution +
     * pricing but are not category search facets, and are never flagged
     * incompatible on a category change. Absent ⇒ category-schema dimension.
     */
    custom?: boolean;
    /**
     * Additive (hybrid variants): for a category `select` dimension, the subset
     * of `values` the seller appended beyond the category schema's option list
     * (e.g. adding 12GB to an 8/16/32GB RAM dimension, XS to S/M/L). These sell
     * like any other value but are not category search facets and are never
     * flagged incompatible on a category change.
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
    views?: string;
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

  /**
   * Seller-authored "Delivery Information" block shown on the storefront Product
   * Detail (region + a short list of quick-service delivery facts — COD, same-day,
   * instant confirmation, …). Absent ⇒ the storefront shows a platform default.
   */
  deliveryInfo?: {
    region?: string;
    bullets?: string[];
  };

  /**
   * "Warranty & After-Sales Services" — the after-sales bullet list. The warranty
   * duration / type / provider / terms live on the canonical CatalogProduct
   * (and snapshot into orders); this holds only the free after-sales facts.
   */
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
