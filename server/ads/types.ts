export type AdsOwnerRole = 'seller' | 'creator' | 'admin';

export type AdsStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'disabled';

export type AdsKind = 'deal' | 'promotion' | 'banner' | 'external';

export type AdCreative = {
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  mediaType?: 'image' | 'gif' | 'video';
  logoUrl?: string;
  advertiserName?: string;
  /** Authoritative Choosify catalog category id (Category Promoted Slot). */
  categoryId?: string;
  /** Presentation label synced from catalog — not used for matching. */
  categoryName?: string;
  hostCategoryName?: string;
  hostCategoryImageUrl?: string;
  hostSubcategories?: string[];
  productTitle?: string;
  salePriceLabel?: string;
  previousPriceLabel?: string;
  discountLabel?: string;
  ratingLabel?: string;
  [key: string]: unknown;
};

export type AdCta = {
  label?: string;
  url?: string;
  destinationType?: 'internal' | 'external';
  internalEntityType?: string;
  internalEntityId?: string;
  [key: string]: unknown;
};

/**
 * Unified Ads & Deals record (Deal / PromotionRequest / BannerAd / ExternalAd).
 */
export type AdRecord = {
  id: string;
  /** Permanent Choosify Advertisement Reference ID (AD-#####) for banner/promo/external ads. */
  advertisementReferenceId?: string;
  /** Permanent Choosify Deal Reference ID (DL-#####) when kind === 'deal'. */
  dealReferenceId?: string;
  ownerId: string;
  ownerRole: AdsOwnerRole;
  listingId?: string;
  brandId?: string;
  title: string;
  status: AdsStatus;
  kind: AdsKind;
  /** Visual format id from placement registry (banner/direct ads). */
  formatId?: string;
  /** Canonical placement id from placement registry. */
  placementId?: string;
  pageKey?: string;
  creative?: AdCreative;
  cta?: AdCta;
  externalUrl?: string;
  /** Legacy free-form placement label (kept for older records). */
  placement?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type CreateAdInput = {
  ownerId: string;
  ownerRole: AdsOwnerRole;
  listingId?: string;
  brandId?: string;
  title: string;
  kind: AdsKind;
  formatId?: string;
  placementId?: string;
  pageKey?: string;
  creative?: AdCreative;
  cta?: AdCta;
  externalUrl?: string;
  placement?: string;
  startsAt?: string;
  endsAt?: string;
  metadata?: Record<string, unknown>;
  /** When true, start as draft instead of pending/approved path. */
  asDraft?: boolean;
  /** Admin-only: publish immediately as active. */
  publishNow?: boolean;
};
