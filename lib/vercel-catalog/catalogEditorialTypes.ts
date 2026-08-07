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

export interface CatalogGuide {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorAvatar?: string;
  category: string;
  excerpt?: string;
  image: string;
  videoUrl?: string;
  duration?: string;
  type: 'article' | 'reels' | 'video' | 'shorts';
  readTime: string;
  views: string;
  shares?: string;
  tags: string[];
  creatorId?: string;
  productIds: string[];
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

export interface CatalogProductDetail {
  productId: string;
  relatedInfoType?: 'price_across_stores' | 'whats_nearby' | 'before_your_visit';
  priceAcrossStoresEnabled?: boolean;
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
  };
  about?: string;
  specs: { key: string; value: string }[];
  pros: string[];
  cons: string[];
  bestForTags: string[];
  storeComparisonList: Array<{
    id: string;
    storeName: string;
    price: number;
    availability: string;
    storeRating?: number;
    storeUrl?: string;
    storeLocation?: string;
    isFeatured?: boolean;
  }>;
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
  optionGroups: Array<{ id: string; name: string; displayType: string; values: string[] }>;
  productVariants: Array<{
    id: string;
    sku: string;
    price?: number;
    stock?: number;
    options: Record<string, string>;
    images?: string[];
    enabled?: boolean;
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
  addonItems?: Array<{ id: string; title: string; description?: string; price: number }>;
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
