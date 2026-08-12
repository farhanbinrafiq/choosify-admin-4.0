import React from 'react';
import { PromotedBadge, type StorefrontAdCreativeProps } from './types';

/**
 * Organic category card with embedded PROMOTED footer sub-slot.
 * Upper card remains organic; only the footer strip is paid placement.
 */
export function CategoryPromotedSlot({
  advertiserName,
  advertiserLogoUrl,
  hostCategoryName = 'Category',
  hostCategoryImageUrl,
  hostProductCountLabel = 'Products & brands',
  hostSubcategories = [],
  showPromotedBadge = true,
  className = '',
}: StorefrontAdCreativeProps) {
  return (
    <div className={`w-full max-w-[320px] overflow-hidden rounded-xl border border-[#E8EDF2] bg-white shadow-sm ${className}`}>
      <div
        className="aspect-[16/10] bg-[#F3F4F6]"
        style={
          hostCategoryImageUrl
            ? {
                backgroundImage: `url(${hostCategoryImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />
      <div className="p-3">
        <div className="text-[14px] font-extrabold text-[#111827]">{hostCategoryName}</div>
        <div className="mt-1 text-[11px] text-[#6B7280] font-semibold">{hostProductCountLabel}</div>
        {hostSubcategories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hostSubcategories.map((s) => (
              <span key={s} className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold text-[#374151]">
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {/* Embedded promoted sub-slot — does not convert the whole card into an ad */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#111827] text-white">
        <div className="flex items-center gap-2 min-w-0">
          {advertiserLogoUrl ? (
            <img src={advertiserLogoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-extrabold">
              {(advertiserName || 'A').charAt(0)}
            </div>
          )}
          <span className="text-[11px] font-bold truncate">{advertiserName || 'Advertiser'}</span>
        </div>
        {showPromotedBadge ? <PromotedBadge /> : null}
      </div>
    </div>
  );
}
