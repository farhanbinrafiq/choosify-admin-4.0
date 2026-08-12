import React from 'react';
import { PromotedBadge, type StorefrontAdCreativeProps } from './types';

/** Deal of the Day — pricing comes from linked listing when available. */
export function DealOfTheDayAd({
  advertiserName,
  headline,
  productTitle,
  imageUrl,
  salePriceLabel,
  previousPriceLabel,
  discountLabel,
  ratingLabel,
  ctaLabel = 'Grab Deal',
  showPromotedBadge = true,
  className = '',
}: StorefrontAdCreativeProps) {
  return (
    <div className={`w-full overflow-hidden rounded-xl border border-[#E8EDF2] bg-white ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-[#111827] text-white">
        <span className="text-[11px] font-extrabold tracking-wide">DEAL OF THE DAY</span>
        {showPromotedBadge ? <PromotedBadge /> : null}
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-3 p-3">
        <div
          className="aspect-square rounded-lg bg-[#F3F4F6]"
          style={
            imageUrl
              ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        />
        <div className="min-w-0">
          {advertiserName ? <div className="text-[10px] font-bold text-[#6B7280]">{advertiserName}</div> : null}
          <div className="text-[13px] font-extrabold text-[#111827] leading-snug line-clamp-2">
            {productTitle || headline || 'Deal product'}
          </div>
          {ratingLabel ? <div className="mt-1 text-[10px] text-amber-600 font-bold">{ratingLabel}</div> : null}
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-[16px] font-extrabold text-[#EF3C23]">{salePriceLabel || '—'}</span>
            {previousPriceLabel ? (
              <span className="text-[11px] text-[#9CA3AF] line-through">{previousPriceLabel}</span>
            ) : null}
            {discountLabel ? (
              <span className="text-[10px] font-extrabold text-emerald-600">{discountLabel}</span>
            ) : null}
          </div>
          <button type="button" className="mt-3 rounded-lg bg-[#EF3C23] px-3 py-1.5 text-[11px] font-extrabold text-white">
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
