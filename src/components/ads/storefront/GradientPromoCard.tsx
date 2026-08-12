import React from 'react';
import { PromotedBadge, type StorefrontAdCreativeProps } from './types';

/** Compact gradient promo — reuses Choosify orange gradient language. */
export function GradientPromoCard({
  advertiserName,
  advertiserLogoUrl,
  headline,
  subtext,
  ctaLabel = 'Explore',
  showPromotedBadge = true,
  className = '',
}: StorefrontAdCreativeProps) {
  return (
    <div
      className={`w-full max-w-[280px] overflow-hidden rounded-xl p-4 text-white bg-gradient-to-br from-[#C8321A] via-[#EF3C23] to-amber-500 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {advertiserLogoUrl ? (
            <img src={advertiserLogoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-white/40" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-extrabold">
              {(advertiserName || 'A').charAt(0)}
            </div>
          )}
          <span className="text-[11px] font-bold truncate">{advertiserName || 'Advertiser'}</span>
        </div>
        {showPromotedBadge ? <PromotedBadge /> : null}
      </div>
      <div className="mt-3 text-[15px] font-extrabold leading-snug">{headline || 'Promo headline'}</div>
      {subtext ? <div className="mt-1 text-[11px] text-white/85 leading-snug">{subtext}</div> : null}
      <button type="button" className="mt-3 rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#EF3C23]">
        {ctaLabel}
      </button>
    </div>
  );
}
