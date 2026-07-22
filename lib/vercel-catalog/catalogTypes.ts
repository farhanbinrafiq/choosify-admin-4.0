export type CatalogPublishStatus = 'draft' | 'live' | 'archived';

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

export interface CatalogBrand {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  logo: string;
  verifiedStatus: boolean;
  claimStatus: 'community' | 'pending' | 'verified';
  followers: number;
  ratings: number;
  featuredFlag: boolean;
  sponsoredFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
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
    | 'transport';
  relatedInfoType?: 'price_across_stores' | 'whats_nearby' | 'before_your_visit';
  /** Physical products: opt-in toggle for showing Price Across Stores. */
  priceAcrossStoresEnabled?: boolean;
  requiredBookingFieldKeys?: string[];
  price: number;
  originalPrice?: number;
  stock: number;
  status: CatalogPublishStatus;
  tags: string[];
  isDeal: boolean;
  dealType?: 'flash' | 'seasonal' | 'brand' | 'promo' | 'clearance';
  discountPercent?: number;
  promoCode?: string;
  dealValidUntil?: string;
  featuredFlag: boolean;
  isNewArrival: boolean;
  isBestseller: boolean;
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
  seoEntries: import('./catalogEditorialTypes').SiteSeoEntry[];
  announcementBarText: string;
  announcementBarEnabled: boolean;
  productBadges?: SiteProductBadge[];
  websiteAssets?: SiteWebsiteAssets;
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
