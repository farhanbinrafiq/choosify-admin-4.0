import React from 'react';
import { PromotedBadge, type StorefrontAdCreativeProps } from './types';
import { inferHeroMediaType } from '@/shared/ads/heroMedia';

/**
 * Wide horizontal hero — storefront-parity presentation.
 *
 * Existing Choosify homepage CMS hero is image/background based (no native
 * <video> player in the public Home hero). For Ads Hero Banner we support:
 * - IMAGE / GIF via <img object-cover> (GIF animates; images use cover crop)
 * - VIDEO via hosted http(s) mp4/webm URL with muted autoplay loop playsInline
 *   (no controls) — standard hero video behavior; no upload/transcode pipeline.
 */
export function HeroBannerAd({
  advertiserName,
  advertiserLogoUrl,
  headline,
  subtext,
  ctaLabel = 'Shop Now',
  imageUrl,
  videoUrl,
  posterUrl,
  mediaType: mediaTypeProp,
  showPromotedBadge = true,
  className = '',
}: StorefrontAdCreativeProps) {
  const mediaType = inferHeroMediaType(videoUrl || imageUrl, mediaTypeProp);
  const poster = posterUrl || (mediaType === 'video' ? imageUrl : undefined);
  const visualSrc = mediaType === 'video' ? videoUrl || imageUrl : imageUrl;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-[#0B1220] aspect-[21/9] min-h-[160px] ${className}`}
    >
      {mediaType === 'video' && visualSrc ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={visualSrc}
          poster={poster || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          // Storefront hero has no player chrome — keep controls off.
          controls={false}
        />
      ) : visualSrc ? (
        <img
          src={visualSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#C8321A] via-[#EF3C23] to-amber-600" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          {advertiserLogoUrl ? (
            <img src={advertiserLogoUrl} alt="" className="h-7 w-7 rounded-full object-cover border border-white/30" />
          ) : null}
          {advertiserName ? <span className="text-[11px] font-bold opacity-90">{advertiserName}</span> : null}
          {showPromotedBadge ? <PromotedBadge /> : null}
        </div>
        <div className="text-lg md:text-2xl font-extrabold leading-tight max-w-xl">
          {headline || 'Hero headline'}
        </div>
        {subtext ? <div className="mt-1 text-[12px] md:text-sm text-white/80 max-w-lg">{subtext}</div> : null}
        <button
          type="button"
          className="mt-3 inline-flex items-center rounded-lg bg-[#EF3C23] px-4 py-2 text-[11px] font-extrabold text-white"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
