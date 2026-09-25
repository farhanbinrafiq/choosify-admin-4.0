import type { ProfileImageCropParams } from '../../shared/media/profileImageCrop';

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

/** Supported Admin-defined attribute field types (IS-003 §9). */
export type CatalogAttributeType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select';

/**
 * Category-scoped attribute / variant-dimension definition (IS-003 §9–§10).
 * Schema is Admin-owned; listings store values separately under `attributes`.
 */
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
  /** When true, this attribute may be used as a Product variant dimension. */
  variantEligible: boolean;
  unit?: string;
  /** Allowed values for select / multi_select. */
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
  /** The ORIGINAL (unframed) upload behind `logo`, when one is stored — lets
   *  the shared profile-image adjustment editor resume against the real
   *  source instead of re-framing an already-framed image. Absent for logos
   *  saved before this existed. */
  logoOriginal?: string;
  /** Scale/position of `logo` against `logoOriginal`, for resuming edits. */
  logoCrop?: ProfileImageCropParams;
  /** Hero / cover banner for brand profile */
  coverImage?: string;
  tagline?: string;
  website?: string;
  socialLinks?: CatalogSocialLinks;
  /** Long-form brand story shown on storefront */
  story?: string;
  /**
   * Multi-entry hybrid Brand Story sections (fall back to `story` when empty).
   * Each section is `text` (heading + body), `link` (url + custom thumbnail) or
   * `content` (a Guide / Review / Live / blog published on Choosify).
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
  /** HTTPS URL for brand story / review embed */
  storyVideoUrl?: string;
  credentials?: string;
  overview?: CatalogBrandOverview;
  faq?: CatalogBrandFaq[];
  stores?: CatalogBrandStores;
  promoCodes?: CatalogBrandPromoCode[];
  /** Seller-curated product ids spotlighted at the top of the brand "Top Deals & Coupons" section, in order. */
  pinnedProductIds?: string[];
  /** Seller-curated product ids pinned to the front of the brand Products grid, in order. */
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
  /** Public storefront visibility. Seller drafts default false. */
  marketplaceAccess?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  /** Permanent Choosify Product Reference ID (PR-#####). Not SKU. */
  productReferenceId?: string;
  /** Optional seller/catalog SKU — coexists with productReferenceId. */
  sku?: string;
  description: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  image: string;
  gallery: string[];
  modeType: 'retail';
  productType?: 'physical' | 'service';
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
  /** Deposit percent required upfront when partialPaymentEnabled is true. */
  depositPercent?: number;
  requiredBookingFieldKeys?: string[];
  /** Service listings only. Whether a new booking request needs seller approval before pay. */
  requiresApproval?: boolean;
  price: number;
  originalPrice?: number;
  stock: number;
  status: CatalogPublishStatus;
  /** Warranty configuration set by the seller. Orders snapshot these at purchase time — see CommerceOrderItemSnapshot. */
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
  /**
   * Per-listing attribute values keyed by category attribute `key` (IS-003 §11).
   * Legacy listings may omit this; empty category schemas skip strict validation.
   */
  attributes?: Record<string, unknown>;
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

/** Homepage "Today's Deals" image-only carousel banners */
export type DealsBannerDestinationType = 'product' | 'brand' | 'custom-url';

export interface CatalogDealsBanner {
  id: string;
  image: string;
  destinationType: DealsBannerDestinationType;
  /** Product ID, brand ID, or raw URL depending on destinationType */
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
  /** Image-only banners for homepage Today's Deals carousel */
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

export type SiteConfig = {
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
  seoEntries: import('./catalogEditorialTypes').SiteSeoEntry[];
  announcementBarText: string;
  announcementBarEnabled: boolean;
  productBadges?: SiteProductBadge[];
  websiteAssets?: SiteWebsiteAssets;
  /** Sprint 11: genuinely editable global settings (site name, support contacts). */
  websiteName?: string;
  supportEmail?: string;
  supportPhone?: string;
  /** Editorial CTA/banner strips -- Website Manager -> CTA & Banners. Not paid/sponsored placements (see CatalogPlacement). */
  ctaBanners?: CtaBannerItem[];
  /** Optional storefront auth-page (Login/Signup/Forgot/Reset/Seller-Signup) left-column visual -- Website Manager -> CTA & Banners -> Auth Page Visual. Unset renders the approved no-image fallback. */
  authVisual?: {
    storefrontImage?: string;
    storefrontImageAlt?: string;
  };
  /** Storefront Curation -> Deals: editorial pins (Top Coupons / Popular Deal Categories / Brand Deals), keyed by placement. Not paid placement (see CatalogPlacement). */
  storefrontCuration?: import('../../shared/storefront/storefrontCuration').StorefrontCurationConfig;
  /** Storefront Curation -> Trust & Assurance: per-placement strip content. Absent placement = live-content defaults. */
  assuranceStrips?: import('../../shared/storefront/storefrontCuration').AssuranceStripsConfig;
  /** Storefront Curation audit trail (newest first, capped). Super Admin only — stripped from public reads. */
  storefrontCurationAudit?: import('../../shared/storefront/storefrontCuration').CurationAuditEntry[];
  updatedAt: string;
};

/**
 * "creator_signup"/"seller_signup" are first-class destination types (not a
 * magic string nested under "external") because they resolve client-side to
 * the current partner-signup origin (dev/prod aware) rather than being a
 * literal stored URL like a real "external" destination.
 */
export type CtaDestinationType = 'internal' | 'creator_signup' | 'seller_signup' | 'external' | 'none';

/** Which page this CTA renders on -- must have a matching entry in the shared placement registry. */
export type CtaPageKey = 'home' | 'brands' | 'deals' | 'categories' | 'products' | 'search' | 'creators';

/** Where relative to the named section this CTA renders. */
export type CtaPosition = 'before' | 'after';

/** Reuses the existing authenticated-role/session lookup already used by BecomeCreatorSidebarCard -- not a new segmentation engine. */
export type CtaAudienceRule =
  | 'none'
  | 'guests_only'
  | 'logged_in_only'
  | 'hide_if_has_creator_account'
  | 'hide_if_has_seller_account';

export interface CtaBannerItem {
  /** Unique internal name/key, e.g. "creators.join_cta" -- content is Admin-managed. Validated unique. */
  id: string;
  /** Which page renders this. */
  page: CtaPageKey;
  /** Registry section key on that page (e.g. "creators-grid"). */
  section: string;
  /** Before or after that section. */
  position: CtaPosition;
  title: string;
  subtitle: string;
  buttonLabel: string;
  destinationType: CtaDestinationType;
  /**
   * Internal: a storefront app route (e.g. "/suggest-brand"). External: a full
   * https:// URL. Unused (empty) for creator_signup / seller_signup / none.
   */
  destinationValue: string;
  /** Ignored for destinationType "none". */
  openInNewTab: boolean;
  enabled: boolean;
  /** Scoped within the same (page, section, position) group -- not a global order. */
  order: number;
  style?: 'navy' | 'purple' | 'orange' | 'light';
  icon?: string;
  startDate?: string;
  endDate?: string;
  audienceRule?: CtaAudienceRule;
}

/** Inventory record persisted via catalogStore (IS-003). */
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

/** Service catalog foundation (Sprint 3). */
export interface CatalogService {
  id: string;
  slug: string;
  title: string;
  description: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  serviceCategory?: string;
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

export type {
  CatalogCreator,
  CatalogGuide,
  CatalogPlacement,
  CatalogProductDetail,
  CatalogMediaItem,
  SiteSeoEntry,
  CatalogPlacementSponsorType,
} from './catalogEditorialTypes';
