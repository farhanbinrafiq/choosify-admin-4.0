import React from 'react';
import type { StorefrontAdCreativeProps } from './types';

/** Specialized Follow Brands CTA banner. */
export function FollowBrandsBanner({
  headline = 'Want exclusive brand deals?',
  subtext = 'Follow your favorite brands for early access offers and drops.',
  ctaLabel = 'FOLLOW BRANDS',
  imageUrl,
  className = '',
}: StorefrontAdCreativeProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl min-h-[110px] ${className}`}
      style={
        imageUrl
          ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      <div className={`absolute inset-0 ${imageUrl ? 'bg-[#000435]/80' : 'bg-gradient-to-r from-[#000435] to-[#111827]'}`} />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-5 text-white">
        <div>
          <div className="text-[16px] md:text-[18px] font-extrabold">{headline}</div>
          <div className="mt-1 text-[12px] text-white/75 max-w-xl">{subtext}</div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-[#EF3C23] px-5 py-2.5 text-[11px] font-extrabold tracking-wide"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
