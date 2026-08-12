import React from 'react';
import { HeroBannerAd } from './HeroBannerAd';
import { VerticalPromoCard } from './VerticalPromoCard';
import { GradientPromoCard } from './GradientPromoCard';
import { DealOfTheDayAd } from './DealOfTheDayAd';
import { FollowBrandsBanner } from './FollowBrandsBanner';
import { CategoryPromotedSlot } from './CategoryPromotedSlot';
import type { StorefrontAdCreativeProps } from './types';

export function StorefrontAdPresentation(props: StorefrontAdCreativeProps) {
  switch (props.formatId) {
    case 'hero_banner':
      return <HeroBannerAd {...props} />;
    case 'vertical_card':
      return <VerticalPromoCard {...props} />;
    case 'gradient_promo':
      return <GradientPromoCard {...props} />;
    case 'deal_of_the_day':
      return <DealOfTheDayAd {...props} />;
    case 'follow_brands_banner':
      return <FollowBrandsBanner {...props} />;
    case 'category_promoted_slot':
      return <CategoryPromotedSlot {...props} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-[#E8EDF2] p-6 text-[12px] text-[#6B7280]">
          Unsupported format
        </div>
      );
  }
}

export * from './types';
export { HeroBannerAd } from './HeroBannerAd';
export { VerticalPromoCard } from './VerticalPromoCard';
export { GradientPromoCard } from './GradientPromoCard';
export { DealOfTheDayAd } from './DealOfTheDayAd';
export { FollowBrandsBanner } from './FollowBrandsBanner';
export { CategoryPromotedSlot } from './CategoryPromotedSlot';
