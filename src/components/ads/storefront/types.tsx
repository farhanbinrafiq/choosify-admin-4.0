/** Shared storefront ad presentation — used by public storefront AND Ads Visual Builder preview. */

export type HeroMediaType = 'image' | 'gif' | 'video';

export type StorefrontAdCreativeProps = {
  formatId: string;
  advertiserName?: string;
  advertiserLogoUrl?: string;
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  imageUrl?: string;
  /** Hero video — hosted http(s) mp4/webm URL (no platform transcoder). */
  videoUrl?: string;
  /** Optional poster/fallback for video Hero. */
  posterUrl?: string;
  /** Explicit creative type; inferred from URL when omitted. */
  mediaType?: HeroMediaType;
  /** Deal of the Day product fields (authoritative when listing-linked) */
  productTitle?: string;
  salePriceLabel?: string;
  previousPriceLabel?: string;
  discountLabel?: string;
  ratingLabel?: string;
  /** Category card host context for embedded sub-slot */
  categoryId?: string;
  hostCategoryName?: string;
  hostCategoryImageUrl?: string;
  hostProductCountLabel?: string;
  hostSubcategories?: string[];
  showPromotedBadge?: boolean;
  className?: string;
};

export function PromotedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white bg-black/55 ${className}`}
    >
      PROMOTED
    </span>
  );
}
