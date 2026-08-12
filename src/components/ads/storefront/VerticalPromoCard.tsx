import React from 'react';
import { PromotedBadge, type StorefrontAdCreativeProps } from './types';

/** Tall sidebar promotional unit. */
export function VerticalPromoCard({
  advertiserName,
  headline,
  subtext,
  ctaLabel = 'Learn More',
  imageUrl,
  showPromotedBadge = true,
  className = '',
}: StorefrontAdCreativeProps) {
  return (
    <div className={`w-full max-w-[260px] overflow-hidden rounded-xl border border-[#E8EDF2] bg-white shadow-sm ${className}`}>
      <div
        className="relative aspect-[3/4] bg-[#F3F4F6]"
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {showPromotedBadge ? <div className="absolute top-2 left-2"><PromotedBadge /></div> : null}
      </div>
      <div className="p-3">
        {advertiserName ? <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wide">{advertiserName}</div> : null}
        <div className="mt-1 text-[13px] font-extrabold text-[#111827] leading-snug">{headline || 'Promo headline'}</div>
        {subtext ? <div className="mt-1 text-[11px] text-[#6B7280] leading-snug">{subtext}</div> : null}
        <button type="button" className="mt-3 w-full rounded-lg bg-[#EF3C23] py-2 text-[11px] font-extrabold text-white">
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
